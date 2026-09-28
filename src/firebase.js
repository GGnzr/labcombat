// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// TODO: Replace with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAGyuV-o1ztv2BXQJgftLgRw1SIJnZXt_k",
  authDomain: "labcombat.firebaseapp.com",
  databaseURL:"https://labcombat-default-rtdb.firebaseio.com",
  projectId: "labcombat",
  storageBucket: "labcombat.firebasestorage.app",
  messagingSenderId: "698833429003",
  appId: "1:698833429003:web:f105a21e1e267c17f15d0e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
