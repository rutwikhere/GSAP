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

const getRelativeISOString = (minutesOffset) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutesOffset);
  return d.toISOString();
};

const getDefaultMockMeets = () => {
  return [
    {
      id: "mock-meet-1",
      name: "Rohit Deshmukh",
      gid: "GID-2026-4012",
      meetLink: "https://meet.google.com/abc-defg-hij",
      timing: getRelativeISOString(-15), // Started 15 mins ago (LIVE)
      duration: 90, // 1.5 hours
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "mock-meet-2",
      name: "Aisha Patel",
      gid: "GID-2026-9054",
      meetLink: "https://meet.google.com/xyz-uvwx-yza",
      timing: getRelativeISOString(15), // Starting in 15 mins (STARTING SOON)
      duration: 60, // 1 hour
      createdAt: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: "mock-meet-3",
      name: "Arjun Verma",
      gid: "GID-2026-7832",
      meetLink: "https://meet.google.com/qwe-rtyu-iop",
      timing: getRelativeISOString(120), // Starting in 2 hours (UPCOMING)
      duration: 120, // 2 hours
      createdAt: new Date(Date.now() - 900000).toISOString()
    },
    {
      id: "mock-meet-4",
      name: "Sanya Gupta",
      gid: "GID-2026-1122",
      meetLink: "https://meet.google.com/mnb-vcxz-lkj",
      timing: getRelativeISOString(1440), // Starting in 24 hours (UPCOMING tomorrow)
      duration: 60, // 1 hour
      createdAt: new Date().toISOString()
    },
    {
      id: "mock-meet-5",
      name: "Kabir Mehta",
      gid: "GID-2026-3344",
      meetLink: "https://meet.google.com/poi-uytr-ewq",
      timing: getRelativeISOString(-180), // Concluded 3 hours ago
      duration: 60, // 1 hour
      createdAt: new Date(Date.now() - 14400000).toISOString()
    }
  ];
};

const getLocalStorageMeets = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const defaultData = getDefaultMockMeets();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return defaultData;
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
        throw new Error("This Google Meet link has already been registered!");
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
      throw new Error("This Google Meet link has already been registered!");
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
