import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4pgu5aRhBGCoxuLLtiwoBv9HxYfjAU88",
  authDomain: "clinchworks.firebaseapp.com",
  projectId: "clinchworks",
  storageBucket: "clinchworks.firebasestorage.app",
  messagingSenderId: "616739425824",
  appId: "1:616739425824:web:ce4c952aa4d5154487f645"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
