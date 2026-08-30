"use client";import{getApp,getApps,initializeApp}from"firebase/app";import{getAuth}from"firebase/auth";import{getFirestore}from"firebase/firestore";import{getStorage}from"firebase/storage";import{initializeAppCheck,ReCaptchaV3Provider}from"firebase/app-check";
const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY??"",authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN??"",projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID??"",storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET??"",messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID??"",appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID??""};const app=getApps().length?getApp():initializeApp(config);export const firebaseAuth=getAuth(app);export const firestore=getFirestore(app);export const firebaseStorage=getStorage(app);export const firebaseConfigured=Object.values(config).every(Boolean);
// App Check readiness: initializes only in the browser, only once Firebase itself is configured,
// and only when NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is set (a Firebase console reCAPTCHA v3 key
// registration - not done by this change, see docs/SECURITY.md). Until that key is provisioned this
// block never runs, so nothing about existing request behavior changes. It stays inert client-side
// readiness until App Check enforcement is also turned on server-side, which requires the same
// console step first and is intentionally left for a separate, deliberate change.
const appCheckSiteKey=process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY??"";
if(typeof window!=="undefined"&&firebaseConfigured&&appCheckSiteKey){
  if(process.env.NODE_ENV!=="production"&&process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN){
    (self as unknown as{FIREBASE_APPCHECK_DEBUG_TOKEN?:string|boolean}).FIREBASE_APPCHECK_DEBUG_TOKEN=process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
  initializeAppCheck(app,{provider:new ReCaptchaV3Provider(appCheckSiteKey),isTokenAutoRefreshEnabled:true});
}
