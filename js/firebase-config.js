/**
 * Firebase configuration for Ergon
 * --------------------------------
 * 1. Go to https://console.firebase.google.com
 * 2. Create a project (or use an existing one)
 * 3. Add a Web app → copy the firebaseConfig object below
 * 4. Enable Authentication → Email/Password
 * 5. Create a Firestore Database (start in test mode, then apply rules below)
 *
 * Suggested Firestore rules (Production):
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId} {
 *         allow read: if request.auth != null;
 *         allow create: if request.auth != null && request.auth.uid == userId;
 *         allow update: if request.auth != null;
 *       }
 *     }
 *   }
 */

const firebaseConfig = {
  apiKey: "AIzaSyCn-GuFWQizP3NbCKP-IxZ-Gx9MdFGTtOk",
  authDomain: "ergon-web.firebaseapp.com",
  projectId: "ergon-web",
  storageBucket: "ergon-web.firebasestorage.app",
  messagingSenderId: "759046541887",
  appId: "1:759046541887:web:4a7ecd76a369ac06915e8a"
};

// Initialize Firebase (compat SDK loaded in index.html)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

window.ergonFirebase = { auth, db, firebase };
