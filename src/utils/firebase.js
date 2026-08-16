import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Placeholder / Fallback Config
const defaultFirebaseConfig = {
  apiKey: "__PROJECTSPROXI_MANAGED__",
  authDomain: "foodex-a9dee.firebaseapp.com",
  projectId: "foodex-a9dee",
  storageBucket: "foodex-a9dee.firebasestorage.app",
  messagingSenderId: "353370597203",
  appId: "1:353370597203:web:c068380c899e14a4a663a6",
  measurementId: "G-B0HRSN2VXV"
};

// Retrieve from local cache or ProjectsProxi
const cachedConfigStr = typeof window !== 'undefined' ? localStorage.getItem('foodex_firebase_config') : null;
let parsedCached = null;
try {
  if (cachedConfigStr) parsedCached = JSON.parse(cachedConfigStr);
} catch (e) {}

export const firebaseConfig = (typeof window !== 'undefined' && window.__FOODEX_CONFIG__) 
  ? window.__FOODEX_CONFIG__ 
  : (parsedCached || defaultFirebaseConfig);

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export const googleProvider = new GoogleAuthProvider();

// Asynchronously sync latest config from ProjectsProxi
if (typeof window !== 'undefined') {
  const proxyEndpoints = ['/api/config/foodex', 'http://127.0.0.1:8765/api/config/foodex'];
  for (const ep of proxyEndpoints) {
    fetch(ep)
      .then(res => res.ok ? res.json() : null)
      .then(remoteData => {
        if (remoteData && remoteData.apiKey && !remoteData.apiKey.startsWith('__')) {
          localStorage.setItem('foodex_firebase_config', JSON.stringify(remoteData));
          window.__FOODEX_CONFIG__ = remoteData;
        }
      })
      .catch(() => {});
  }
}

