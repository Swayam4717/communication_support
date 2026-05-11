// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getFirestore} from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDjNvOB39FYkdn4nXwwgsGBWs0NY1-jOaY",
  authDomain: "communication-mvp-7b34d.firebaseapp.com",
  projectId: "communication-mvp-7b34d",
  storageBucket: "communication-mvp-7b34d.firebasestorage.app",
  messagingSenderId: "476548938852",
  appId: "1:476548938852:web:1e4698571671ed64497371"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);