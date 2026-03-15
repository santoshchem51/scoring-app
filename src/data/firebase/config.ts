import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);

// App Check — protects Firebase services from abuse
// Uses reCAPTCHA Enterprise in production, debug token in development
// TODO: When deploying with reCAPTCHA, add https://www.google.com and
// https://recaptcha.net to script-src and connect-src in firebase.json CSP headers
if (import.meta.env.DEV) {
  // Debug token for development/testing — allows App Check to pass without reCAPTCHA
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false') {
  connectFirestoreEmulator(firestore, '127.0.0.1', 8180);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  // Expose Firebase SDK on window for E2E tests (page.evaluate can't resolve bare specifiers)
  (window as any).__TEST_FIREBASE__ = { auth, firestore };
  import('firebase/auth').then((mod) => {
    (window as any).__TEST_FIREBASE_AUTH__ = mod;
  });
  import('firebase/firestore').then((mod) => {
    (window as any).__TEST_FIREBASE_FIRESTORE__ = mod;
  });
}
