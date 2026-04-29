import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAAcJGz-VsCEs898EJ7okG3BA3ZeNFjsLc",
  authDomain: "task-collage-creator.firebaseapp.com",
  projectId: "task-collage-creator",
  storageBucket: "task-collage-creator.firebasestorage.app",
  messagingSenderId: "260200332475",
  appId: "1:260200332475:web:0a7598e89fb724abb6fd9e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const RENDER_API_URL = "https://collage-creator.onrender.com";
