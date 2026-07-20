import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDpFiagvaW_i7cRFxslzC3pwuPnQoe_UXY",
  authDomain: "foodex-a9dee.firebaseapp.com",
  projectId: "foodex-a9dee",
  storageBucket: "foodex-a9dee.firebasestorage.app",
  messagingSenderId: "353370597203",
  appId: "1:353370597203:web:c068380c899e14a4a663a6",
  measurementId: "G-B0HRSN2VXV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
