"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOrganization } from '@/lib/organization';
import { useAuth } from '@/lib/auth';
import { classifyApiErrorKind, type ApiErrorKind } from '@/lib/api';
import { t } from '@/lib/i18n';
import { Button, Card, Empty, Loading } from '@/components/product-ui';
import { AdminMaster } from './components/AdminMaster';
import { Header } from './components/Header';
import { ProgressBar } from './components/ProgressBar';
import { LandingView } from './components/LandingView';
import { Step1Identity } from './components/steps/Step1Identity';
import { Step2Customers } from './components/steps/Step2Customers';
import { Step3Services } from './components/steps/Step3Services';
import { Step4Advantage } from './components/steps/Step4Advantage';
import { Step5Brand } from './components/steps/Step5Brand';
import { Step6Uploads } from './components/steps/Step6Uploads';
import { Step7Technical } from './components/steps/Step7Technical';
import { Step8Review } from './components/steps/Step8Review';
import { Step9Completion } from './components/steps/Step9Completion';
import { NavigationControls } from './components/NavigationControls';
import { WhatsAppHelpButton } from './components/WhatsAppHelpButton';
import { AiSummaryModal } from './components/AiSummaryModal';
import { DiscoveryData, StepKey } from './types';
import { firebaseDiscoveryService, SaveStatus } from './services/firebaseDiscoveryService';
import { INITIAL_DISCOVERY_DATA } from './data/initialData';
import { canProceedFromStep, hasAnyMissingRequiredField, missingFieldsForStep } from './utils/discoveryValidation';

// Real integration entry point (2026-09-17 Discovery unification): mounted directly by
// apps/web/src/app/discovery/page.tsx inside the existing AuthenticatedOrganization gate, so
// organizationId/projectId come from the same real routing every other pageloom-os route uses —
// never a self-generated project ID.
//
// AdminMaster (re-enabled 2026-09-17 at Isaac's explicit request — "use the existing /admin page,
// don't create another one") is reached via ?view=admin on this same route, exactly like the
// original AI Studio app's own admin toggle, but role-gated: only owner/admin ever see it, since
// AuthenticatedOrganization's gate here checks authentication only, not role. A client (customer)
// must never be able to reach it, even by guessing the query param.

export default function App() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("projectId") ?? "";
  const isAdminRequested = params.get("view") === "admin";
  const { organizationId, membership, loading: orgLoading } = useOrganization();
  const { signOut } = useAuth();
  const s = t("discoveryShell");
  const isStaff = membership?.role === "owner" || membership?.role === "admin";

  // Called synchronously during render, not inside an effect: AdminMaster is a child
  // of this component and its own mount effect (subscribeAllClients) fires before this
  // component's effects, so setting organizationId on the singleton here — instead of
  // inside the load() effect below — is what makes it available in time.
  if (organizationId) firebaseDiscoveryService.configure(organizationId);

  const [data, setData] = useState<DiscoveryData>();
  const [loadErrorKind, setLoadErrorKind] = useState<ApiErrorKind>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  // Reveals per-field "required" highlighting/messages only after the customer actually tries to
  // move on from an incomplete step — never on a still-blank step's first render. Reset on every
  // step change so leftover errors from a previous attempt don't bleed into the next step.
  const [showValidation, setShowValidation] = useState(false);
  // Final submission must never show the success screen (step 9) until the server has actually
  // confirmed it — see the 2026-09-18 production bug where /submit returned a real 400 (a
  // Firestore transaction ordering bug, since fixed server-side) while the UI advanced to the
  // success screen anyway, because completeDiscoveryTransaction's result was never awaited.
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const load = useCallback(() => {
    if (!organizationId || !projectId) return;
    firebaseDiscoveryService.loadClientDiscovery(projectId)
      .then(result => { setLoadErrorKind(undefined); setData(result); })
      .catch(failure => setLoadErrorKind(classifyApiErrorKind(failure)));
  }, [organizationId, projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsubscribe = firebaseDiscoveryService.subscribeStatus(setSaveStatus);
    return () => unsubscribe();
  }, []);

  const updateDiscovery = useCallback((updates: Partial<DiscoveryData>) => {
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      firebaseDiscoveryService.saveDiscovery(next);
      return next;
    });
  }, []);

  if (orgLoading) return <Loading />;
  if (isAdminRequested) {
    if (!isStaff) return <Card><Empty title={s.permissionDenied} description="" /></Card>;
    return <AdminMaster
      currentProject={{ ...INITIAL_DISCOVERY_DATA }}
      onSelectProjectToEdit={() => { /* staff editing a customer's own answers is out of scope */ }}
      onCloseAdmin={() => router.push("/portal")}
    />;
  }
  if (!projectId) return <Card><Empty title={s.noProjectSelected} description="" /></Card>;
  // Distinct, accurate messages per failure cause (docs/customer-discovery-onboarding/PRD.md §30),
  // matching the pre-unification page.tsx's own error handling — a customer who was denied access
  // or has no connection must never see a blank questionnaire with no explanation.
  if (loadErrorKind) return <Card role="alert">
    <p className="text-xs text-[var(--danger-text)]">
      {loadErrorKind === "network" ? s.networkOffline
        : loadErrorKind === "session_expired" ? s.sessionExpired
        : loadErrorKind === "permission_denied" ? s.permissionDenied
        : s.loadError}
    </p>
    {loadErrorKind === "session_expired" && <Button className="mt-4 min-h-11" onClick={() => void signOut()}>{s.signInAgain}</Button>}
  </Card>;
  if (orgLoading || !data) return <Loading />;

  const handleSelectStep = (step: StepKey | 0) => {
    // Reset here (an event handler), not in a useEffect keyed on the step — leftover
    // missing-field highlighting from a previous attempt must never bleed into the next step,
    // but resetting it is a direct consequence of navigating, not a value derived from watching
    // data.currentStep change after the fact.
    setShowValidation(false);
    const completedSet = new Set(data.completedSteps);
    // Only credit the step being left as "completed" when actually moving forward past it with
    // its required fields satisfied — going back (onPrev) or jumping to an earlier step to edit
    // must never falsely mark an incomplete step as done (that green checkmark on the progress
    // bar would otherwise lie).
    const isAdvancing = typeof step === 'number' && step > data.currentStep;
    if (isAdvancing && data.currentStep >= 1 && data.currentStep <= 9 && canProceedFromStep(data.currentStep, data)) {
      completedSet.add(data.currentStep);
    }
    const isFinished = step === 9;
    const nowIso = new Date().toISOString();
    const next: DiscoveryData = {
      ...data, currentStep: step, completedSteps: Array.from(completedSet),
      isCompleted: isFinished ? true : data.isCompleted, isLocked: isFinished ? true : false,
      completedAt: isFinished && !data.completedAt ? nowIso : data.completedAt,
    };
    setData(next);
    // Step 9 is reached ONLY via submitForReal below, after the server has already confirmed
    // success — by the time handleSelectStep(9) runs, there is nothing left to submit, just the
    // local "show the success screen" transition (which itself is still autosaved, matching
    // every other step, so a refresh doesn't lose the isCompleted/isLocked flags).
    firebaseDiscoveryService.saveDiscovery(next, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The Next button stays visually enabled/disabled based on canProceed but is never given a
  // native `disabled` attribute (see NavigationControls) — a hard-disabled button can't be
  // clicked at all, which on mobile especially gives no feedback about *why*. Clicking it while
  // invalid instead reveals the highlighting/messages and scrolls to the first missing field.
  const handleNext = () => {
    if (data.currentStep >= 9) return;
    if (!canProceedFromStep(data.currentStep, data)) { setShowValidation(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    handleSelectStep((data.currentStep + 1) as StepKey);
  };
  const handlePrev = () => { if (data.currentStep <= 1) handleSelectStep(0); else handleSelectStep((data.currentStep - 1) as StepKey); };
  // Shared gate for both places that can finish the Discovery: NavigationControls' own "step
  // 8 -> 9" Next button and Step8Review's separate final-submit CTA. Blocks on EVERY required
  // question across the whole flow, not just step 8's (which has none of its own — it's a
  // read-only summary).
  const attemptFinish = () => {
    if (submitting) return; // already in flight — ignore a double-click rather than double-submit
    if (hasAnyMissingRequiredField(data)) { setShowValidation(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    void submitForReal();
  };
  // The only path to the success screen. Awaits the server's actual result — the whole point of
  // this function existing separately from handleSelectStep(9) — so the customer is never shown
  // "success" for a submission that the server rejected.
  const submitForReal = async () => {
    setSubmitting(true);
    setSubmitError(undefined);
    const success = await firebaseDiscoveryService.completeDiscoveryTransaction(data.customerId || data.projectId, data);
    setSubmitting(false);
    if (success) handleSelectStep(9);
    else { setSubmitError(s.submitError); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const stats = firebaseDiscoveryService.calculateDiscoveryStats(data);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] bg-[radial-gradient(ellipse_80%_80%_at_50%_-15%,rgba(224,231,255,0.45),rgba(255,255,255,0))] text-slate-900 selection:bg-indigo-500 selection:text-white font-sans antialiased" dir="rtl">
      <Header
        businessName={data.businessName}
        ownerName={data.ownerName}
        projectId={data.projectId}
        saveStatus={saveStatus}
        onOpenAiSummary={() => setIsAiModalOpen(true)}
        onOpenHelp={() => setIsHelpOpen(!isHelpOpen)}
        {...(isStaff ? { isAdminView: false, onToggleAdmin: () => router.push(`/discovery?view=admin`) } : {})}
      />

      {data.currentStep > 0 && (
        <ProgressBar
          currentStep={data.currentStep as StepKey}
          completedSteps={data.completedSteps}
          onSelectStep={step => handleSelectStep(step)}
          progressPercentage={stats.progressPercentage}
        />
      )}

      {/* pb-28 (vs. the sticky NavigationControls bar's ~80-100px height) keeps a step's last
          field from sitting right behind that bar — most noticeable on a long step like
          Step2Customers/Step4Advantage where the final textarea would otherwise end flush
          against it. */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-28 sm:pb-10">
        {data.isLocked && data.currentStep > 0 && (
          <div className="mb-6 bg-gradient-to-r from-indigo-50 via-purple-50/60 to-white border border-indigo-200/80 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">🔒</div>
              <div>
                <div className="text-sm font-bold text-indigo-950">שאלון האפיון נעול לצפייה בלבד</div>
                <div className="text-xs text-indigo-700/80 mt-0.5">הפרויקט נמצא בטיפול ופיתוח אצל צוות PageLoom.</div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {data.currentStep === 0 && (
            <motion.div key="step-0" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              <LandingView
                ownerName={data.ownerName}
                businessName={data.businessName}
                hasPreviousData={data.completedSteps.length > 0 || !!data.businessName}
                onStart={() => handleSelectStep(1)}
                onReset={() => {
                  const fresh: DiscoveryData = { ...INITIAL_DISCOVERY_DATA, projectId: data.projectId, customerId: data.customerId, lastUpdated: new Date().toISOString(), currentStep: 0, completedSteps: [], isCompleted: false };
                  setData(fresh);
                  firebaseDiscoveryService.saveDiscovery(fresh, true);
                }}
              />
            </motion.div>
          )}

          {data.currentStep > 0 && (
            <motion.div key={`step-${data.currentStep}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-indigo-100/30 p-6 sm:p-10">
              {data.currentStep === 1 && <Step1Identity data={data} onChange={updateDiscovery} missingFields={missingFieldsForStep(1, data)} showErrors={showValidation} />}
              {data.currentStep === 2 && <Step2Customers data={data} onChange={updateDiscovery} missingFields={missingFieldsForStep(2, data)} showErrors={showValidation} />}
              {data.currentStep === 3 && <Step3Services data={data} onChange={updateDiscovery} missingFields={missingFieldsForStep(3, data)} showErrors={showValidation} />}
              {data.currentStep === 4 && <Step4Advantage data={data} onChange={updateDiscovery} missingFields={missingFieldsForStep(4, data)} showErrors={showValidation} />}
              {data.currentStep === 5 && <Step5Brand data={data} onChange={updateDiscovery} missingFields={missingFieldsForStep(5, data)} showErrors={showValidation} />}
              {data.currentStep === 6 && <Step6Uploads data={data} onChange={updateDiscovery} />}
              {data.currentStep === 7 && <Step7Technical data={data} onChange={updateDiscovery} missingFields={missingFieldsForStep(7, data)} showErrors={showValidation} />}
              {data.currentStep === 8 && <Step8Review data={data} onEditStep={s2 => handleSelectStep(s2)} onProceedToCompletion={attemptFinish} showValidation={showValidation} submitting={submitting} submitError={submitError} />}
              {data.currentStep === 9 && <Step9Completion data={data} onNavigateToStep={s2 => handleSelectStep(s2)} onOpenAiSummary={() => setIsAiModalOpen(true)} />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {data.currentStep > 0 && data.currentStep < 9 && (
        <NavigationControls
          currentStep={data.currentStep as StepKey}
          totalSteps={9}
          onPrev={handlePrev}
          onNext={data.currentStep === 8 ? attemptFinish : handleNext}
          canProceed={canProceedFromStep(data.currentStep, data)}
          submitting={data.currentStep === 8 && submitting}
        />
      )}

      <WhatsAppHelpButton projectId={data.projectId} businessName={data.businessName} isOpen={isHelpOpen} onToggle={() => setIsHelpOpen(!isHelpOpen)} />
      <AiSummaryModal data={data} isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />

      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/60 mt-auto">
        <div>כל הזכויות שמורות © {new Date().getFullYear()} <strong>PageLoom</strong> • פלטפורמת אפיון עסק חכמה ומאובטחת ב-Firebase</div>
      </footer>
    </div>
  );
}
