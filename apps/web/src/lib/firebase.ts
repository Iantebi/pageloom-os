"use client";import{getApp,getApps,initializeApp}from"firebase/app";import{initializeAppCheck,ReCaptchaV3Provider,type AppCheck}from"firebase/app-check";import{getAuth}from"firebase/auth";import{getFirestore}from"firebase/firestore";import{getStorage}from"firebase/storage";
const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY??"",authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN??"",projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID??"",storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET??"",messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID??"",appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID??""};const app=getApps().length?getApp():initializeApp(config);export const firebaseAuth=getAuth(app);export const firestore=getFirestore(app);export const firebaseStorage=getStorage(app);export const firebaseConfigured=Object.values(config).every(Boolean);
// App Check, monitoring-first (docs/mfa-app-check/ROLLOUT.md): only initializes when a site key is
// configured, and the whole thing is wrapped in try/catch behind a browser-only guard. App Check
// only attaches an extra header to outgoing requests - it never gates anything client-side - and
// enforcement (rejecting requests without a valid token) is a separate Firebase Console setting
// left untouched here, so a misconfigured or unreachable reCAPTCHA endpoint can never block
// sign-in or break the app for an existing user.
export let firebaseAppCheck:AppCheck|undefined;
const appCheckSiteKey=process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY??"";
if(typeof window!=="undefined"&&firebaseConfigured&&appCheckSiteKey){try{
  const debugToken=process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN;
  if(debugToken&&process.env.NODE_ENV!=="production")(self as typeof self&{FIREBASE_APPCHECK_DEBUG_TOKEN?:string|boolean}).FIREBASE_APPCHECK_DEBUG_TOKEN=debugToken;
  firebaseAppCheck=initializeAppCheck(app,{provider:new ReCaptchaV3Provider(appCheckSiteKey),isTokenAutoRefreshEnabled:true});
}catch{/* fails safe: sign-in, Firestore, and Storage keep working with no App Check token attached */}}
