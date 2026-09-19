import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  ref,
  get,
  set,
  update,
  onValue,
  push,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { COUNTRIES, randomDigits, formatE164, prettyPhone, genCode } from "./countries.js";

const CODE_TTL = 20000;
const START_CREDITS = 20;

let user = null;
let profile = { credits: START_CREDITS, numbers: [] };
let selected = COUNTRIES.find((c) => c.iso === "RU") || COUNTRIES[1];
let activeNumber = null;
let tick = null;

const $ = (id) => document.getElementById(id);

renderCountries();
renderCredits();

onAuthStateChanged(auth, async (u) => {
  if (!u) {
    location.href = "login.html";
    return;
  }
  user = u;
  $("who").textContent = u.email || u.displayName || "";
  profile = loadLocal(u.uid);
  renderCredits();
  renderCountries();
  renderLocalNumbers();

  try {
    const snap = await get(ref(db, `users/${u.uid}`));
    const remote = snap.exists() ? snap.val() : null;
    if (!remote) {
      await set(ref(db, `users/${u.uid}`), {
        email: u.email || "",
        displayName: u.displayName || "",
        credits: profile.credits,
        createdAt: Date.now(),
      });
    } else {
      const remoteCredits = Number(remote.credits);
      if (Number.isFinite(remoteCredits) && remoteCredits > profile.credits) {
        profile.credits = remoteCredits;
      } else if (!Number.isFinite(remoteCredits) || remoteCredits <= 0) {
        await update(ref(db, `users/${u.uid}`), { credits: profile.credits });
      } else {
        profile.credits = Math.max(profile.credits, remoteCredits);
      }
    }
  } catch (_) {
    /* правила базы могут быть закрыты — работаем локально */
  }

  saveLocal();
  renderCredits();
  listenMyNumbers();
});

$("outBtn").onclick = () => signOut(auth);
$("searchC").oninput = () => renderCountries($("searchC").value);
$("genBtn").onclick = generate;
$("copyPhone").onclick = () => copy(activeNumber?.e164, "Номер скопирован");
$("copyCode").onclick = () => copy(String($("codeView").textContent || "").replace(/\D/g, ""), "Код скопирован");

$("buyBtn").onclick = async () => {
  profile.credits = Number(profile.credits || 0) + 10;
  saveLocal();
  renderCredits();
  $("genMsg").className = "msg ok";
  $("genMsg").textContent = `Начислено 10 монет. Сейчас ${profile.credits}.`;
  if (!user) return;
  try {
    await update(ref(db, `users/${user.uid}`), { credits: profile.credits });
  } catch (_) {}
};

function creditKey() {
  return `black_credits_${user?.uid || "guest"}`;
}

function loadLocal(uid) {
  try {
    const raw = localStorage.getItem(`black_profile_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Number.isFinite(Number(parsed.credits))) parsed.credits = START_CREDITS;
      parsed.numbers = parsed.numbers || [];
      return parsed;
    }
  } catch (_) {}
  return { credits: START_CREDITS, numbers: [] };
}

function saveLocal() {
  if (!user) return;
  localStorage.setItem(`black_profile_${user.uid}`, JSON.stringify(profile));
}

function renderCredits() {
  $("creditsVal").textContent = String(profile.credits ?? 0);
}

function renderCountries(q = "") {
  const box = $("countries");
  if (!box) return;
  const query = q.trim().toLowerCase();
  box.innerHTML = "";
  COUNTRIES.filter(
    (c) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.dial.includes(query) ||
      c.iso.toLowerCase().includes(query)
  ).forEach((c) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "country" + (selected.iso === c.iso && selected.dial === c.dial ? " active" : "");
    el.innerHTML = `<span>${c.flag} ${c.name} <b>+${c.dial}</b></span>${
      c.paid ? '<span class="paid">3 монеты</span>' : "<span>1 монета</span>"
    }`;
    el.onclick = () => {
      selected = c;
      renderCountries($("searchC").value);
    };
    box.appendChild(el);
  });
}

async function generate() {
  const msg = $("genMsg");
  msg.className = "msg";
  if (!selected) {
    msg.className = "msg err";
    msg.textContent = "Сначала выбери страну.";
    return;
  }
  const cost = selected.paid ? 3 : 1;
  if ((profile.credits || 0) < cost) {
    msg.className = "msg err";
    msg.textContent = `Нужно ${cost} монет. Нажми «Пополнить +10».`;
    return;
  }

  const local = randomDigits(selected.len);
  const e164 = formatE164(selected.dial, local);
  const code = genCode();
  const now = Date.now();
  const rec = {
    e164,
    iso: selected.iso,
    country: selected.name,
    dial: selected.dial,
    paid: !!selected.paid,
    ownerUid: user?.uid || "local",
    ownerEmail: user?.email || "",
    currentCode: code,
    updatedAt: now,
    expiresAt: now + CODE_TTL,
    createdAt: now,
  };

  profile.credits = Math.max(0, Number(profile.credits || 0) - cost);
  profile.numbers = [{ e164, country: selected.name, createdAt: now }, ...(profile.numbers || [])].slice(0, 20);
  saveNumber(rec);
  saveLocal();
  renderCredits();
  setActive(rec);
  renderLocalNumbers();

  msg.className = "msg ok";
  msg.textContent = "Номер готов. Скопируй его и код в приложение.";

  if (!user) return;
  try {
    await set(ref(db, `virtualNumbers/${sanitize(e164)}`), rec);
    await update(ref(db, `users/${user.uid}`), { credits: profile.credits });
    await push(ref(db, `users/${user.uid}/numbers`), { e164, country: selected.name, createdAt: now });
  } catch (_) {
    msg.textContent = "Номер готов локально. В Firebase не записался — проверь правила базы, если нужен вход с другого устройства.";
  }
}

function renderLocalNumbers() {
  const items = profile.numbers || [];
  if (!$("myNumbers")) return;
  $("myNumbers").innerHTML =
    items
      .slice(0, 8)
      .map(
        (n) =>
          `<div class="row"><span>${prettyPhone(n.e164)}<br/><small style="color:var(--muted)">${n.country || ""}</small></span><button class="btn btn-ghost" data-open="${n.e164}">Открыть</button></div>`
      )
      .join("") || `<div class="row"><span>Пока нет номеров</span></div>`;
  $("myNumbers").querySelectorAll("[data-open]").forEach((btn) => {
    btn.onclick = async () => {
      const e164 = btn.dataset.open;
      try {
        const s = await get(ref(db, `virtualNumbers/${sanitize(e164)}`));
        if (s.exists()) {
          setActive(s.val());
          return;
        }
      } catch (_) {}
      if (activeNumber?.e164 === e164) setActive(activeNumber);
      else
        setActive({
          e164,
          country: items.find((x) => x.e164 === e164)?.country || "",
          paid: e164.startsWith("+888"),
          currentCode: genCode(),
          expiresAt: Date.now() + CODE_TTL,
        });
    };
  });
}

function listenMyNumbers() {
  if (!user) return;
  try {
    onValue(ref(db, `users/${user.uid}/numbers`), async (snap) => {
      const val = snap.val() || {};
      const items = Object.values(val).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (!items.length) return;
      const have = new Set((profile.numbers || []).map((n) => n.e164));
      items.forEach((n) => {
        if (n.e164 && !have.has(n.e164)) profile.numbers.unshift(n);
      });
      saveLocal();
      renderLocalNumbers();
    });
  } catch (_) {}
}

function setActive(rec) {
  activeNumber = rec;
  $("countryPill").textContent = `${rec.country || "номер"} · ${rec.paid ? "анонимный" : "обычный"}`;
  $("phoneView").textContent = prettyPhone(rec.e164);
  startRotation();
}

function startRotation() {
  if (tick) clearInterval(tick);
  rotateIfNeeded();
  tick = setInterval(rotateIfNeeded, 250);
}

async function rotateIfNeeded() {
  if (!activeNumber) return;
  const now = Date.now();
  if (!activeNumber.expiresAt || now >= activeNumber.expiresAt) {
    const code = genCode();
    activeNumber = { ...activeNumber, currentCode: code, updatedAt: now, expiresAt: now + CODE_TTL };
    saveNumber(activeNumber);
    try {
      if (user) {
        await update(ref(db, `virtualNumbers/${sanitize(activeNumber.e164)}`), {
          currentCode: code,
          updatedAt: now,
          expiresAt: now + CODE_TTL,
        });
      }
    } catch (_) {}
  }
  const left = Math.max(0, (activeNumber.expiresAt || now) - now);
  $("codeView").textContent = activeNumber.currentCode || "------";
  $("timerView").textContent = `обновится через ${(left / 1000).toFixed(1)} сек`;
  $("bar").style.transform = `scaleX(${left / CODE_TTL})`;
}

function saveNumber(rec) {
  try {
    localStorage.setItem(`black_virtual_${sanitize(rec.e164)}`, JSON.stringify(rec));
  } catch (_) {}
}

function sanitize(e164) {
  return String(e164).replace(/[.#$\[\]]/g, "_");
}

async function copy(text, ok) {
  if (!text || text.includes("•")) return;
  try {
    await navigator.clipboard.writeText(text);
    $("genMsg").className = "msg ok";
    $("genMsg").textContent = ok;
  } catch {
    $("genMsg").className = "msg";
    $("genMsg").textContent = text;
  }
}
