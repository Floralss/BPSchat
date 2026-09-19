import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const regForm = document.getElementById("regForm");
const loginForm = document.getElementById("loginForm");
const regMsg = document.getElementById("regMsg");
const logMsg = document.getElementById("logMsg");

onAuthStateChanged(auth, (user) => {
  if (user && !sessionStorage.getItem("stayOnAuth")) {
    location.href = "dashboard.html";
  }
});

regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  regMsg.className = "msg";
  regMsg.textContent = "Создаю…";
  try {
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPass").value;
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await set(ref(db, `users/${cred.user.uid}`), {
      email,
      displayName: name,
      credits: 5,
      createdAt: Date.now(),
      theme: "dark",
      bio: "",
    });
    regMsg.className = "msg ok";
    regMsg.textContent = "Готово. Перехожу в кабинет…";
    location.href = "dashboard.html";
  } catch (err) {
    regMsg.className = "msg err";
    regMsg.textContent = human(err);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  logMsg.className = "msg";
  logMsg.textContent = "Вхожу…";
  try {
    const email = document.getElementById("logEmail").value.trim();
    const pass = document.getElementById("logPass").value;
    await signInWithEmailAndPassword(auth, email, pass);
    location.href = "dashboard.html";
  } catch (err) {
    logMsg.className = "msg err";
    logMsg.textContent = human(err);
  }
});

function human(err) {
  const c = err?.code || "";
  if (c.includes("email-already-in-use")) return "Эта почта уже зарегистрирована.";
  if (c.includes("invalid-email")) return "Некорректная почта.";
  if (c.includes("weak-password")) return "Пароль слишком короткий.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "Неверная почта или пароль.";
  if (c.includes("network")) return "Нет сети или Firebase недоступен.";
  return err.message || "Ошибка.";
}
