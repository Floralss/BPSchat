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
let user = null;
let profile = { credits: 0 };
let selected = COUNTRIES[1];
let activeNumber = null;
let tick = null;
let localExpire = 0;

const $ = (id) => document.getElementById(id);

onAuthStateChanged(auth, async (u) => {
  if (!u) {
    location.href = "login.html";
    return;
  }
  user = u;
  $("who").textContent = u.email;
  const snap = await get(ref(db, `users/${u.uid}`));
  profile = snap.val() || { credits: 5, displayName: u.displayName || "" };
  if (profile.credits == null) profile.credits = 5;
  renderCredits();
  renderCountries();
  listenMyNumbers();
});

$("outBtn").onclick = () => signOut(auth);
$("searchC").oninput = () => renderCountries($("searchC").value);
$("genBtn").onclick = generate;
$("copyPhone").onclick = () => copy(activeNumber?.e164, "Номер скопирован");
$("copyCode").onclick = () => copy($("codeView").textContent.replace(/\s/g, ""), "Код скопирован");
$("buyBtn").onclick = async () => {
  if (!user) return;
  const next = (profile.credits || 0) + 10;
  await update(ref(db, `users/${user.uid}`), { credits: next });
  profile.credits = next;
  renderCredits();
};

function renderCredits() {
  $("creditsVal").textContent = profile.credits ?? 0;
}

function renderCountries(q = "") {
  const box = $("countries");
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
      c.paid ? '<span class="paid">3 кр.</span>' : "<span>+1 кр.</span>"
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
  const cost = selected.paid ? 3 : 1;
  if ((profile.credits || 0) < cost) {
    msg.className = "msg err";
    msg.textContent = "Недостаточно кредитов. Нажми «+10 демо».";
    return;
  }
  const local = randomDigits(selected.len);
  const e164 = formatE164(selected.dial, local);
  const exists = await get(ref(db, `virtualNumbers/${sanitize(e164)}`));
  if (exists.exists()) return generate();

  const code = genCode();
  const now = Date.now();
  const rec = {
    e164,
    iso: selected.iso,
    country: selected.name,
    dial: selected.dial,
    paid: !!selected.paid,
    ownerUid: user.uid,
    ownerEmail: user.email,
    currentCode: code,
    updatedAt: now,
    expiresAt: now + CODE_TTL,
    createdAt: now,
  };

  try {
    await set(ref(db, `virtualNumbers/${sanitize(e164)}`), rec);
    await update(ref(db, `users/${user.uid}`), { credits: (profile.credits || 0) - cost });
    profile.credits = (profile.credits || 0) - cost;
    await push(ref(db, `users/${user.uid}/numbers`), { e164, country: selected.name, createdAt: now });
    renderCredits();
    setActive(rec);
    msg.className = "msg ok";
    msg.textContent = "Номер готов. Введи его в приложении и этот код.";
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = err.message || "Не удалось записать в Firebase. Проверь правила RTDB.";
  }
}

function listenMyNumbers() {
  onValue(ref(db, `users/${user.uid}/numbers`), async (snap) => {
    const val = snap.val() || {};
    const items = Object.values(val).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    $("myNumbers").innerHTML = items
      .slice(0, 8)
      .map(
        (n) =>
          `<div class="row"><span>${prettyPhone(n.e164)}<br/><small style="color:var(--muted)">${n.country || ""}</small></span><button class="btn btn-ghost" data-open="${n.e164}">Открыть</button></div>`
      )
      .join("") || `<div class="row"><span>Пока нет номеров</span></div>`;
    $("myNumbers").querySelectorAll("[data-open]").forEach((btn) => {
      btn.onclick = async () => {
        const s = await get(ref(db, `virtualNumbers/${sanitize(btn.dataset.open)}`));
        if (s.exists()) setActive(s.val());
      };
    });
    if (!activeNumber && items[0]) {
      const s = await get(ref(db, `virtualNumbers/${sanitize(items[0].e164)}`));
      if (s.exists()) setActive(s.val());
    }
  });
}

function setActive(rec) {
  activeNumber = rec;
  $("countryPill").textContent = `${rec.country} · ${rec.paid ? "анонимный" : "обычный"}`;
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
    const rec = { ...activeNumber, currentCode: code, updatedAt: now, expiresAt: now + CODE_TTL };
    activeNumber = rec;
    try {
      await update(ref(db, `virtualNumbers/${sanitize(rec.e164)}`), {
        currentCode: code,
        updatedAt: now,
        expiresAt: now + CODE_TTL,
      });
    } catch (_) {
      /* keep local rotation even if rules block write */
    }
  }
  const left = Math.max(0, (activeNumber.expiresAt || now) - now);
  $("codeView").textContent = activeNumber.currentCode || "------";
  $("timerView").textContent = `обновится через ${(left / 1000).toFixed(1)} сек`;
  $("bar").style.transform = `scaleX(${left / CODE_TTL})`;
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
    $("genMsg").className = "msg err";
    $("genMsg").textContent = text;
  }
}
