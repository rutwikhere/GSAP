import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";

// Firebase credentials from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Simple check to verify config is populated and does not contain example strings
const isValidConfigValue = (val) => val && val.trim() !== "" && !val.includes("your_");
const hasFirebaseConfig = Object.values(firebaseConfig).every(isValidConfigValue);

let db = null;
let isRealFirebase = false;

if (hasFirebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isRealFirebase = true;
    console.log("Firebase initialized successfully in Firestore mode.");
  } catch (error) {
    console.error("Failed to initialize Firebase, falling back to LocalStorage mode:", error);
    isRealFirebase = false;
  }
} else {
  console.log("Firebase credentials not configured in env. Running in LocalStorage fallback mode.");
}

// --- LocalStorage Mock Database Helpers ---
const STORAGE_KEY = "gsap_meets_database";

const getLocalStorageMeets = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  }
  return JSON.parse(data);
};

const saveLocalStorageMeets = (meets) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meets));
};

// --- Exported Database Interface ---

/**
 * Fetches all meet submissions.
 * Returns an array of meets.
 */
export const fetchMeets = async () => {
  if (isRealFirebase) {
    try {
      const meetsCol = collection(db, "meets");
      const q = query(meetsCol, orderBy("timing", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return list;
    } catch (error) {
      console.error("Firestore read failed, falling back to LocalStorage:", error);
      return getLocalStorageMeets();
    }
  } else {
    // Return LocalStorage data sorted chronologically
    return getLocalStorageMeets().sort((a, b) => new Date(a.timing) - new Date(b.timing));
  }
};

/**
 * Adds a new meet submission.
 * Enforces duplicate link checking.
 * @param {Object} meetData { name, gid, title, meetLink, timing, duration }
 */
export const submitMeet = async (meetData) => {
  const cleanLink = meetData.meetLink.trim();
  const duration = parseInt(meetData.duration, 10) || 60;

  if (isRealFirebase) {
    try {
      // 1. Check for duplicates in Firestore
      const meetsCol = collection(db, "meets");
      const snapshot = await getDocs(meetsCol);
      const duplicateExists = snapshot.docs.some(
        doc => doc.data().meetLink.trim().toLowerCase() === cleanLink.toLowerCase()
      );

      if (duplicateExists) {
        throw new Error("This Meet link has already been registered!");
      }

      // 2. Insert record
      const docRef = await addDoc(meetsCol, {
        name: meetData.name.trim(),
        gid: meetData.gid.trim(),
        meetLink: cleanLink,
        timing: meetData.timing, // Date-time ISO string
        duration: duration,
        createdAt: new Date().toISOString()
      });

      return { id: docRef.id, ...meetData, duration };
    } catch (error) {
      console.error("Firestore write failed:", error);
      throw error;
    }
  } else {
    // 1. Check for duplicates in LocalStorage
    const meets = getLocalStorageMeets();
    const duplicateExists = meets.some(
      meet => meet.meetLink.trim().toLowerCase() === cleanLink.toLowerCase()
    );

    if (duplicateExists) {
      throw new Error("This Meet link has already been registered!");
    }

    // 2. Insert record
    const newMeet = {
      id: "local-" + Math.random().toString(36).substr(2, 9),
      name: meetData.name.trim(),
      gid: meetData.gid.trim(),
      meetLink: cleanLink,
      timing: meetData.timing,
      duration: duration,
      createdAt: new Date().toISOString()
    };

    meets.push(newMeet);
    saveLocalStorageMeets(meets);
    return newMeet;
  }
};

export { isRealFirebase };
