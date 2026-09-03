import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Authenticated all-route smoke test (issue #35): renders every built route's page.tsx default
// export the way an authenticated Owner would see it - organizationId resolved, one well-formed
// record and one deliberately malformed record (missing exactly the fields the #35 fixes made
// defensive: status/type strings and date strings) per collection a page reads - and asserts the
// render never throws. This is a synchronous, DOM-free render via react-dom/server's
// renderToStaticMarkup, so useEffect-driven data fetching (api() calls, Firestore subscriptions)
// never runs; it exercises exactly the failure mode this issue is about, a crash during the
// synchronous render from a record's shape, not effect timing.
//
// Every page reads organization/session/data state through these shared modules (`@/lib/*`) or
// `next/navigation`/`next/link`, so mocking them once here - rather than per component - covers
// every route and every nested widget a page pulls in transitively.

const mock = vi.hoisted(() => ({
  organizationId: "org1",
  role: "owner" as "owner" | "admin" | "client",
}));

vi.mock("@/lib/organization", () => ({
  useOrganization: () => ({
    organizationId: mock.organizationId,
    organizations: mock.organizationId ? [{ id: mock.organizationId, name: "PageLoom Agency", role: mock.role }] : [],
    membership: mock.organizationId ? { id: mock.organizationId, name: "PageLoom Agency", role: mock.role, customerId: "customer-1" } : undefined,
    setOrganizationId: () => {},
    loading: false,
    error: "",
    retry: () => {},
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Test Owner" }, loading: false, signOut: async () => {} }),
}));

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: { currentUser: { uid: "u1", getIdToken: async () => "token" } },
  firestore: {},
  firebaseStorage: {},
  firebaseConfigured: true,
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(async () => ({})),
  apiFile: vi.fn(async () => new Blob()),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({
    mode: "dark", resolvedMode: "dark", background: "dark", accent: "violet", highContrast: false,
    setMode: () => {}, setBackground: () => {}, setAccent: () => {}, setHighContrast: () => {}, reset: () => {},
  }),
}));

vi.mock("@/lib/discovery", () => ({
  useDiscovery: () => ({ state: undefined, loading: true, error: "", reload: () => {} }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: async () => {} }),
  useSearchParams: () => ({
    get: (key: string) => ({ id: "project-1", projectId: "project-1", organizationId: "org1", customerId: "customer-1" }[key] ?? null),
  }),
  useParams: () => ({}),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => <a href={typeof href === "string" ? href : "#"} {...props}>{children}</a>,
}));

// One well-formed record plus one record missing only the fields issue #35 made defensive
// (status/type, journeyStage/workflowStage, date strings) - not every field, so a route that isn't
// actually reachable from those fixes doesn't fail the smoke test for an unrelated, pre-existing gap.
const GOOD_DATE = "2026-01-15T10:30:00.000Z";
const PROJECTS = [
  { id: "project-1", name: "Acme Site", clientName: "Acme Inc", status: "active", progress: 40, journeyStage: "development", workflowStage: "development", workflowStatus: "active", budget: 5000, revenue: 5000, cost: 1000, updatedAt: GOOD_DATE, deadline: GOOD_DATE, dealClosedAt: GOOD_DATE, responsibleAgents: ["ceo"], nextWorkflowStage: "quality_assurance" },
  { id: "project-2", name: "Malformed Co", clientName: "Malformed Client", budget: 0, revenue: 0, cost: 0, updatedAt: GOOD_DATE, responsibleAgents: [] },
];
const TASKS = [
  { id: "task-1", objective: "Build homepage", status: "running", agentId: "ceo", updatedAt: GOOD_DATE, projectId: "project-1", context: { workflowStage: "development" }, executionMode: "auto", provider: "openai" },
  { id: "task-2", objective: "Malformed task", agentId: "ceo", projectId: "project-1", context: {}, updatedAt: GOOD_DATE },
];
const APPROVALS = [{ id: "approval-1", tool: "deploy", operation: "publish", reason: "Ready", status: "pending", taskId: "task-1", requestedAt: GOOD_DATE }];
const LEADS = [
  { id: "lead-1", name: "Jane Prospect", company: "Prospect Co", status: "qualified", stage: "qualified", value: 4000, updatedAt: GOOD_DATE },
  { id: "lead-2", name: "Malformed Lead", company: "No Status Co", stage: "new", value: 0, updatedAt: GOOD_DATE },
];
const CUSTOMERS = [{ id: "customer-1", businessName: "Acme Inc", industry: "Retail", status: "active", updatedAt: GOOD_DATE, leadId: "lead-1" }];
const NOTIFICATIONS = [
  { id: "n1", title: "Fallback title", body: "Fallback body", type: "domain_expiry", params: { domain: "example.com", daysRemaining: 5 }, read: false, createdAt: GOOD_DATE },
  { id: "n2", title: "Support ticket (malformed params)", type: "support_ticket_created", params: undefined, read: false, createdAt: GOOD_DATE },
];
const CALENDAR_EVENTS = [
  { id: "e1", summary: "Kickoff call", start: GOOD_DATE },
  { id: "e2", summary: "Malformed event", start: "not-a-real-date" },
];
const SUPPORT_TICKETS = [{ id: "t1", projectId: "project-1", customerId: "customer-1", subject: "Help", description: "Need help", priority: "normal", status: "open", responseDueAt: GOOD_DATE, updatedAt: GOOD_DATE }];

function dataForPath(path: string | undefined): unknown[] {
  if (!path) return [];
  if (path.endsWith("/projects")) return PROJECTS;
  if (path.endsWith("/tasks")) return TASKS;
  if (path.endsWith("/notifications")) return NOTIFICATIONS;
  if (path.endsWith("/calendarEvents")) return CALENDAR_EVENTS;
  if (path.endsWith("/leads")) return LEADS;
  if (path.endsWith("/customers")) return CUSTOMERS;
  if (path.endsWith("/approvals")) return APPROVALS;
  if (path.endsWith("/supportTickets")) return SUPPORT_TICKETS;
  return [];
}

vi.mock("@/lib/live-data", () => ({
  useLiveCollection: (path: string | undefined) => ({ data: dataForPath(path), loading: false, error: undefined }),
}));

afterEach(() => {
  mock.organizationId = "org1";
  mock.role = "owner";
});

// dynamic import()s below (rather than static top-of-file imports) so every vi.mock() above is
// installed before each page module - and everything it transitively imports - first loads.
const routes: [name: string, load: () => Promise<{ default: () => React.ReactElement }>][] = [
  ["/", () => import("./page")],
  ["/dashboard", () => import("./(product)/dashboard/page")],
  ["/sales", () => import("./(product)/sales/page")],
  ["/projects", () => import("./(product)/projects/page")],
  ["/projects/view", () => import("./(product)/projects/view/page")],
  ["/agents", () => import("./(product)/agents/page")],
  ["/builder", () => import("./(product)/builder/page")],
  ["/crm", () => import("./(product)/crm/page")],
  ["/portal", () => import("./(product)/portal/page")],
  ["/settings", () => import("./(product)/settings/page")],
  ["/discovery", () => import("./discovery/page")],
  ["/master", () => import("./(product)/master/page")],
  ["/master/content", () => import("./(product)/master/content/page")],
  ["/master/customer", () => import("./(product)/master/customer/page")],
];

describe("authenticated route smoke test", () => {
  for (const [name, load] of routes) {
    it(`renders ${name} for an authenticated Owner without throwing`, async () => {
      const { default: Page } = await load();
      expect(() => renderToStaticMarkup(<Page />)).not.toThrow();
    });
  }

  it("renders /dashboard before the organization has loaded (organizationId still empty)", async () => {
    mock.organizationId = "";
    const { default: Page } = await import("./(product)/dashboard/page");
    expect(() => renderToStaticMarkup(<Page />)).not.toThrow();
  });

  it("renders /projects before the organization has loaded (organizationId still empty)", async () => {
    mock.organizationId = "";
    const { default: Page } = await import("./(product)/projects/page");
    expect(() => renderToStaticMarkup(<Page />)).not.toThrow();
  });
});
