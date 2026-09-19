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
const tabReg = document.getElementById("tabReg");
const tabLog = document.getElementById("tabLog");

tabReg?.addEventListener("click", () => switchTab(true));
tabLog?.addEventListener("click", () => switchTab(false));

function switchTab(isReg) {
  regForm.hidden = !isReg;
  loginForm.hidden = isReg;
  tabReg.classList.toggle("on", isReg);
  tabLog.classList.toggle("on", !isReg);
}

onAuthStateChanged(auth, (user) => {
  if (user && !sessionStorage.getItem("stayOnAuth")) {
    location.href = "dashboard.html";
  }
});

regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  regMsg.className = "msg";
  regMsg.textContent = "Создаю аккаунт…";
  try {
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPass").value;
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await set(ref(db, `users/${cred.user.uid}`), {
      email,
      displayName: name,
      credits: 3,
      createdAt: Date.now(),
      theme: "dark",
      bio: "",
    });
    regMsg.className = "msg ok";
    regMsg.textContent = "Готово. Открываю кабинет…";
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
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("logEmail").value.trim(),
      document.getElementById("logPass").value
    );
    location.href = "dashboard.html";
  } catch (err) {
    logMsg.className = "msg err";
    logMsg.textContent = human(err);
  }
});

function human(err) {
  const c = err?.code || "";
  if (c.includes("email-already-in-use")) return "Эта почта уже занята. Переключись на вход.";
  if (c.includes("invalid-email")) return "Почта написана неправильно.";
  if (c.includes("weak-password")) return "Пароль слишком короткий.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "Неверная почта или пароль.";
  if (c.includes("network")) return "Нет сети или Firebase не отвечает.";
  if (c.includes("operation-not-allowed")) return "В Firebase не включён вход по почте.";
  return err.message || "Не получилось войти.";
}
