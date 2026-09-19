import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBGFONUBgybQr0KCn_Ao_ZT9HkWVSU4jEw",
  authDomain: "black-social-af844.firebaseapp.com",
  databaseURL: "https://black-social-af844-default-rtdb.firebaseio.com",
  projectId: "black-social-af844",
  storageBucket: "black-social-af844.firebasestorage.app",
  messagingSenderId: "296441938682",
  appId: "1:296441938682:web:096a3e642bd00116f7bf43",
  measurementId: "G-2PX2QMR8HS",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

try {
  getAnalytics(app);
} catch (_) {
  /* analytics may fail on file:// */
}
