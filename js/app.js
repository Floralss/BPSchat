import { auth, db, storage } from "./firebase-config.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  push,
  onValue,
  query,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { ref as sref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { COUNTRIES, prettyPhone, codeValid, formatLocal } from "./countries.js";

let pendingPhone = "";

const $ = (id) => document.getElementById(id);
const SESSION_KEY = "black_session";

let session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let currentChat = null;
let unsubMsgs = null;
let prefs = {
  twoFA: true,
  lastSeen: true,
  readReceipts: true,
  calls: true,
  preview: false,
  lock: false,
};

const DEMO_PEOPLE = [
  { id: "demo_nova", name: "Nova", emoji: "✦", sub: "онлайн", last: "Кинула голосовое", time: "сейчас", unread: 2 },
  { id: "demo_leo", name: "Leo", emoji: "⚡", sub: "был(а) недавно", last: "Ок, наберу вечером", time: "12:40", unread: 0 },
  { id: "demo_mira", name: "Mira", emoji: "◇", sub: "в сети", last: "Фото из студии", time: "вчера", unread: 1 },
  { id: "demo_support", name: "BLACK Support", emoji: "B", sub: "бот", last: "Как пользоваться кодом", time: "пн", unread: 0 },
];

const DEMO_THREADS = {
  demo_nova: [
    { from: "you", text: "Привет! Зашла по виртуальному номеру", t: "21:01" },
    { from: "me", text: "Работает. Код с сайта обновился как раз вовремя", t: "21:02" },
    { from: "you", text: "Голосовое · 0:07", t: "21:03", voice: true },
    { from: "me", text: "Слышу отлично", t: "21:03" },
  ],
  demo_leo: [
    { from: "you", text: "Созвонимся?", t: "12:38" },
    { from: "me", text: "Ок, наберу вечером", t: "12:40" },
  ],
  demo_mira: [
    { from: "you", text: "Смотри кадр", t: "вчера" },
    { from: "me", text: "Красиво. Кидай ещё", t: "вчера" },
  ],
  demo_support: [
    { from: "you", text: "1) На сайте войди по почте.\n2) Сгенерируй номер.\n3) Скопируй код (20 сек).\n4) Вставь сюда.", t: "пн" },
    { from: "you", text: "Это учебный прототип: номера не принимают настоящие SMS операторов.", t: "пн" },
  ],
};

init();

async function init() {
  fillCountries();
  bindTabs();
  bindLoginFlow();
  $("backChats").onclick = () => show("chats");
  $("backSet").onclick = () => show("settings");
  $("sendBtn").onclick = sendText;
  $("msgInp").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  });
  $("attachBtn").onclick = () => $("fileInp").click();
  $("fileInp").onchange = sendFile;
  $("voiceBtn").onclick = toggleVoice;
  $("audioCallBtn").onclick = () => startCall(false);
  $("videoCallBtn").onclick = () => startCall(true);
  $("endBtn").onclick = endCall;
  $("muteBtn").onclick = () => toast("микрофон переключён (демо)");
  $("newChatBtn").onclick = () => show("contacts");
  $("findBtn").onclick = startChatByPhone;
  $("editProfBtn").onclick = () => {
    $("editName").value = session?.name || "";
    $("editBio").value = session?.bio || "";
    $("editColor").value = session?.color || "#6d5cff";
    $("editEmoji").value = session?.emoji || "✦";
    show("profile");
  };
  $("saveProf").onclick = saveProfile;
  $("logoutBtn").onclick = logout;
  $("chatSearch").oninput = renderChatList;
  setupPWA();

  if (session?.e164) {
    await ensureAnonAuth();
    enterApp();
  }
}

function setupPWA() {
  const banner = $("installBanner");
  const btn = $("installBtn");
  if (banner) banner.classList.add("show");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    if (btn) {
      btn.style.display = "block";
      btn.onclick = async () => {
        e.prompt();
        btn.style.display = "none";
      };
    }
  });
}

function fillCountries() {
  $("countrySel").innerHTML = COUNTRIES.map(
    (c) => `<option value="${c.iso}|${c.dial}">${c.flag} ${c.name}</option>`
  ).join("");
  $("countrySel").value = "ANON|888";
  updateDial();
  $("countrySel").onchange = () => {
    updateDial();
    formatPhoneField();
  };
}

function selectedCountry() {
  const [iso, dial] = String($("countrySel").value || "ANON|888").split("|");
  return COUNTRIES.find((c) => c.iso === iso && c.dial === dial) || COUNTRIES[0];
}

function updateDial() {
  $("dialPrefix").textContent = `+${selectedCountry().dial}`;
}

function formatPhoneField() {
  const c = selectedCountry();
  const raw = String($("localInp").value || "").replace(/\D/g, "").slice(0, c.len);
  $("localInp").value = formatLocal(raw, c.len);
}

function showLoginStep(id) {
  ["stepStart", "stepPhone", "stepCode"].forEach((s) => {
    $(s).hidden = s !== id;
  });
}

function bindLoginFlow() {
  $("startBtn").onclick = () => showLoginStep("stepPhone");
  $("backStart").onclick = () => showLoginStep("stepStart");
  $("backPhone").onclick = () => showLoginStep("stepPhone");
  $("localInp").addEventListener("input", formatPhoneField);
  $("toCodeBtn").onclick = goToCode;
  document.querySelectorAll(".otp-box").forEach((box) => {
    box.addEventListener("input", onOtpInput);
    box.addEventListener("keydown", onOtpKey);
    box.addEventListener("paste", onOtpPaste);
  });
}

function goToCode() {
  const c = selectedCountry();
  const local = String($("localInp").value || "").replace(/\D/g, "");
  if (local.length < Math.min(6, c.len)) {
    $("phoneErr").textContent = "Введи номер целиком.";
    return;
  }
  $("phoneErr").textContent = "";
  pendingPhone = `+${c.dial}${local}`;
  $("codeHint").textContent = `Номер ${prettyPhone(pendingPhone)}. Бери код, который сейчас крупно на сайте.`;
  document.querySelectorAll(".otp-box").forEach((b) => (b.value = ""));
  $("otpWrap").classList.remove("ok", "bad");
  $("loginErr").textContent = "";
  showLoginStep("stepCode");
  document.querySelector(".otp-box").focus();
}

function otpValue() {
  return [...document.querySelectorAll(".otp-box")].map((b) => b.value).join("");
}

function onOtpInput(e) {
  const i = Number(e.target.dataset.i);
  e.target.value = e.target.value.replace(/\D/g, "").slice(-1);
  if (e.target.value && i < 5) document.querySelector(`.otp-box[data-i="${i + 1}"]`).focus();
  if (otpValue().length === 6) login();
}

function onOtpKey(e) {
  const i = Number(e.target.dataset.i);
  if (e.key === "Backspace" && !e.target.value && i > 0) {
    const prev = document.querySelector(`.otp-box[data-i="${i - 1}"]`);
    prev.value = "";
    prev.focus();
  }
}

function onOtpPaste(e) {
  e.preventDefault();
  const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
  document.querySelectorAll(".otp-box").forEach((b, i) => (b.value = d[i] || ""));
  if (d.length === 6) login();
}

function bindTabs() {
  document.querySelectorAll("#tabs button").forEach((b) => {
    b.onclick = () => {
      if (!session) {
        show("login");
        return;
      }
      document.querySelectorAll("#tabs button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      show(b.dataset.tab);
    };
  });
}

function show(name) {
  if (!session && name !== "login") name = "login";
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const map = {
    login: "screen-login",
    chats: "screen-chats",
    chat: "screen-chat",
    calls: "screen-calls",
    contacts: "screen-contacts",
    settings: "screen-settings",
    profile: "screen-profile",
  };
  $(map[name]).classList.add("active");
  const hideTabs = !session || ["login", "chat", "profile"].includes(name);
  $("tabs").hidden = hideTabs;
  $("tabs").style.display = hideTabs ? "none" : "grid";
  if (name === "chats") renderChatList();
  if (name === "calls") renderCalls();
  if (name === "contacts") renderPeople();
  if (name === "settings") renderSettings();
}

function sanitize(e164) {
  return String(e164).replace(/[.#$\[\]]/g, "_");
}

function normalizePhone(raw) {
  const d = String(raw).replace(/[^\d+]/g, "");
  return d.startsWith("+") ? d : `+${d}`;
}

async function login() {
  const err = $("loginErr");
  err.textContent = "";
  const wrap = $("otpWrap");
  wrap.classList.remove("ok", "bad", "shake");
  const e164 = pendingPhone || `+${selectedCountry().dial}${String($("localInp").value || "").replace(/\D/g, "")}`;
  const code = otpValue();
  if (code.length !== 6) return;
  if (!codeValid(e164, code)) {
    wrap.classList.add("bad", "shake");
    try { navigator.vibrate([80, 40, 80]); } catch (_) {}
    err.textContent = "Неверный код. Возьми новый с сайта.";
    setTimeout(() => wrap.classList.remove("shake"), 500);
    return;
  }
  wrap.classList.add("ok");
  try {
    await ensureAnonAuth();
    const paid = selectedCountry().iso === "ANON";
    session = {
      e164,
      name: "User",
      emoji: paid ? "◈" : "✦",
      color: paid ? "#22e0c2" : "#6d5cff",
      bio: "",
      country: selectedCountry().name,
      uid: auth.currentUser?.uid || null,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    try {
      await set(ref(db, `directory/${sanitize(e164)}`), {
        e164,
        name: session.name,
        emoji: session.emoji,
        lastLogin: Date.now(),
      });
    } catch (_) {}
    setTimeout(() => enterApp(), 450);
  } catch (e) {
    wrap.classList.add("bad", "shake");
    try { navigator.vibrate(120); } catch (_) {}
    err.textContent = e.message || "Ошибка входа.";
  }
}

async function ensureAnonAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (_) {
      /* Auth may be disabled; app still works locally */
    }
  }
}

function enterApp() {
  $("myName").textContent = session.name;
  $("myPhone").textContent = prettyPhone(session.e164);
  paintAva($("myAva"), session);
  $("tabs").hidden = false;
  show("chats");
}

function paintAva(el, who) {
  el.textContent = (who.emoji || who.name || "?").toString().slice(0, 2);
  el.style.background = `linear-gradient(135deg, ${who.color || "#3a3470"}, #1d1b33)`;
}

function renderChatList() {
  const q = ($("chatSearch").value || "").toLowerCase();
  const extra = JSON.parse(localStorage.getItem("black_extra_chats") || "[]");
  const items = [...extra, ...DEMO_PEOPLE].filter(
    (c) => !q || c.name.toLowerCase().includes(q) || (c.last || "").toLowerCase().includes(q)
  );
  $("chatList").innerHTML = items
    .map(
      (c) => `<div class="chat-item" data-id="${c.id}">
        <div class="ava ${c.sub === "онлайн" || c.sub === "в сети" ? "online" : ""}">${c.emoji || c.name[0]}</div>
        <div class="meta">
          <div class="name"><span>${c.name}</span><span class="time">${c.time || ""}</span></div>
          <div class="sub">${c.last || ""}</div>
        </div>
        ${c.unread ? `<span class="unread">${c.unread}</span>` : ""}
      </div>`
    )
    .join("");
  $("chatList").querySelectorAll(".chat-item").forEach((el) => {
    el.onclick = () => openChat(el.dataset.id);
  });
}

function openChat(id) {
  currentChat = id;
  const extra = JSON.parse(localStorage.getItem("black_extra_chats") || "[]");
  const person = [...extra, ...DEMO_PEOPLE].find((p) => p.id === id) || {
    id,
    name: id,
    emoji: "◎",
    sub: "виртуальный чат",
  };
  $("chatName").textContent = person.name;
  $("chatStatus").textContent = person.sub || "BLACK";
  paintAva($("chatAva"), person);
  show("chat");
  renderMessages();
  listenLive(id);
}

function renderMessages() {
  const localKey = `black_thread_${currentChat}`;
  const saved = JSON.parse(localStorage.getItem(localKey) || "null");
  const seed = DEMO_THREADS[currentChat] || [];
  const list = saved || seed;
  $("msgs").innerHTML = list
    .map((m) => {
      if (m.sys) return `<div class="sys">${escapeHtml(m.text)}</div>`;
      const side = m.from === "me" ? "me" : "you";
      let inner = escapeHtml(m.text || "");
      if (m.voice) inner = `▶︎  ————●——  ${escapeHtml(m.text || "голос")}`;
      if (m.image) inner += `<img class="media" src="${m.image}" alt="" />`;
      if (m.video) inner += `<video class="media" src="${m.video}" controls></video>`;
      return `<div class="msg ${side} ${m.voice ? "voice" : ""}">${inner}<span class="t">${m.t || ""}</span></div>`;
    })
    .join("");
  $("msgs").scrollTop = $("msgs").scrollHeight;
}

function persistMsg(m) {
  const localKey = `black_thread_${currentChat}`;
  const seed = JSON.parse(localStorage.getItem(localKey) || "null") || DEMO_THREADS[currentChat] || [];
  seed.push(m);
  localStorage.setItem(localKey, JSON.stringify(seed));
  renderMessages();
}

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function sendText() {
  const text = $("msgInp").value.trim();
  if (!text || !currentChat) return;
  $("msgInp").value = "";
  const m = { from: "me", text, t: nowTime() };
  persistMsg(m);
  pushLive(m);
}

async function sendFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !currentChat) return;
  toast("загружаю…");
  try {
    let url = URL.createObjectURL(file);
    if (auth.currentUser) {
      const path = `media/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
      const r = sref(storage, path);
      await uploadBytes(r, file);
      url = await getDownloadURL(r);
    }
    const m = {
      from: "me",
      text: file.type.startsWith("video") ? "видео" : "фото",
      t: nowTime(),
      image: file.type.startsWith("image") ? url : null,
      video: file.type.startsWith("video") ? url : null,
    };
    persistMsg(m);
    pushLive(m);
  } catch {
    toast("Storage недоступен — файл показан только локально");
    const url = URL.createObjectURL(file);
    persistMsg({
      from: "me",
      text: file.name,
      t: nowTime(),
      image: file.type.startsWith("image") ? url : null,
      video: file.type.startsWith("video") ? url : null,
    });
  }
}

let rec = null;
let chunks = [];
async function toggleVoice() {
  if (rec && rec.state === "recording") {
    rec.stop();
    $("voiceBtn").textContent = "◉";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      persistMsg({ from: "me", text: "голосовое", t: nowTime(), voice: true });
      toast("голосовое отправлено");
    };
    rec.start();
    $("voiceBtn").textContent = "■";
    toast("запись… нажми ещё раз чтобы отправить");
  } catch {
    toast("нет доступа к микрофону");
  }
}

function listenLive(id) {
  if (!id.startsWith("live_")) return;
  onValue(query(ref(db, `messages/${id}`), limitToLast(80)), (snap) => {
    const rows = [];
    snap.forEach((c) => rows.push(c.val()));
    if (!rows.length) return;
    const mapped = rows.map((m) => ({
      from: m.from === session.e164 ? "me" : "you",
      text: m.text,
      t: new Date(m.ts || Date.now()).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      image: m.image || null,
      video: m.video || null,
      voice: m.voice || false,
    }));
    localStorage.setItem(`black_thread_${id}`, JSON.stringify(mapped));
    if (currentChat === id) renderMessages();
  });
}

async function pushLive(m) {
  if (!currentChat?.startsWith("live_")) return;
  try {
    await push(ref(db, `messages/${currentChat}`), {
      from: session.e164,
      text: m.text,
      ts: Date.now(),
      image: m.image || null,
      video: m.video || null,
      voice: !!m.voice,
    });
  } catch (_) {}
}

async function startChatByPhone() {
  const err = $("findErr");
  err.textContent = "";
  const e164 = normalizePhone($("findPhone").value);
  if (e164.length < 8) {
    err.textContent = "Введи номер.";
    return;
  }
  const id = "live_" + [sanitize(session.e164), sanitize(e164)].sort().join("__");
  const extra = JSON.parse(localStorage.getItem("black_extra_chats") || "[]");
  if (!extra.some((c) => c.id === id)) {
    extra.unshift({
      id,
      name: prettyPhone(e164),
      emoji: "◎",
      sub: "новый чат",
      last: "Начало переписки",
      time: nowTime(),
      unread: 0,
    });
    localStorage.setItem("black_extra_chats", JSON.stringify(extra));
  }
  try {
    await set(ref(db, `chats/${id}`), {
      members: { [sanitize(session.e164)]: true, [sanitize(e164)]: true },
      updatedAt: Date.now(),
    });
  } catch (_) {}
  openChat(id);
}

function renderPeople() {
  $("peopleList").innerHTML = DEMO_PEOPLE.map(
    (p) => `<div class="chat-item" data-id="${p.id}">
      <div class="ava">${p.emoji}</div>
      <div class="meta"><div class="name"><span>${p.name}</span></div><div class="sub">${p.sub}</div></div>
    </div>`
  ).join("");
  $("peopleList").querySelectorAll(".chat-item").forEach((el) => {
    el.onclick = () => openChat(el.dataset.id);
  });
}

function renderCalls() {
  const rows = [
    { name: "Nova", sub: "исходящий · 2 мин", t: "сегодня" },
    { name: "Leo", sub: "пропущенный", t: "вчера" },
    { name: "Mira", sub: "входящий · видео 4 мин", t: "пн" },
  ];
  $("callList").innerHTML = rows
    .map(
      (c) => `<div class="chat-item">
        <div class="ava">${c.name[0]}</div>
        <div class="meta"><div class="name"><span>${c.name}</span><span class="time">${c.t}</span></div><div class="sub">${c.sub}</div></div>
      </div>`
    )
    .join("");
}

function item(title, rightHtml) {
  return `<div class="set-item"><div>${title}</div><div class="right">${rightHtml}</div></div>`;
}

function renderSettings() {
  $("myName").textContent = session?.name || "Профиль";
  $("myPhone").textContent = prettyPhone(session?.e164 || "");
  paintAva($("myAva"), session || { emoji: "Я" });
  $("setAccount").innerHTML =
    item("Номер", prettyPhone(session?.e164 || "—")) +
    item("Страна", session?.country || "—") +
    item("Имя", session?.name || "—");
  $("setSec").innerHTML =
    switchRow("Код на сайте", "twoFA") +
    switchRow("Блокировка приложения", "lock") +
    item("Активные сессии", "это устройство");
  $("setPriv").innerHTML =
    switchRow("Время последнего визита", "lastSeen") +
    switchRow("Отчёты о прочтении", "readReceipts") +
    switchRow("Звонки от всех", "calls") +
    switchRow("Превью уведомлений", "preview");
  $("setTheme").innerHTML = item("Тема", "тёмная") + item("Акцент", session?.color || "#6d5cff");
  bindSwitches();
}

function switchRow(title, key) {
  return `<div class="set-item"><div>${title}</div><button class="switch ${prefs[key] ? "on" : ""}" data-sw="${key}" type="button"></button></div>`;
}

function bindSwitches() {
  document.querySelectorAll("[data-sw]").forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.sw;
      prefs[k] = !prefs[k];
      b.classList.toggle("on", prefs[k]);
      localStorage.setItem("black_prefs", JSON.stringify(prefs));
    };
  });
}

async function saveProfile() {
  session.name = $("editName").value.trim() || session.name;
  session.bio = $("editBio").value.trim();
  session.color = $("editColor").value;
  session.emoji = $("editEmoji").value.trim() || session.emoji;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  try {
    await update(ref(db, `directory/${sanitize(session.e164)}`), {
      name: session.name,
      emoji: session.emoji,
      color: session.color,
      bio: session.bio,
    });
  } catch (_) {}
  toast("профиль сохранён");
  show("settings");
}

function startCall(video) {
  const name = $("chatName").textContent;
  $("callName").textContent = name;
  $("callAva").textContent = $("chatAva").textContent;
  $("callState").textContent = video ? "видеозвонок · соединение…" : "аудиозвонок · соединение…";
  $("callUI").classList.add("show");
  setTimeout(() => {
    if ($("callUI").classList.contains("show")) $("callState").textContent = "идёт разговор · 00:05";
  }, 1200);
}

function endCall() {
  $("callUI").classList.remove("show");
  persistMsg({ from: "me", text: "звонок завершён", t: nowTime(), sys: false });
  toast("звонок завершён (демо-интерфейс)");
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  session = null;
  show("login");
  showLoginStep("stepStart");
}

function toast(t) {
  const el = $("toast");
  el.textContent = t;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 2200);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("\n", "<br/>");
}

try {
  prefs = { ...prefs, ...JSON.parse(localStorage.getItem("black_prefs") || "{}") };
} catch (_) {}
