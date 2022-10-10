// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBh5mz6VNDyfEjU78aEfYuOj9PsY8Dk1h0",
  authDomain: "netflix-77046.firebaseapp.com",
  projectId: "netflix-77046",
  storageBucket: "netflix-77046.appspot.com",
  messagingSenderId: "970603964554",
  appId: "1:970603964554:web:8b4956039241064bcca573"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore()
const auth = getAuth()

export default app
export { db, auth }