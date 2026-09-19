import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { ref, set, update, push } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { COUNTRIES, randomDigits, formatE164, prettyPhone, codeFor, CODE_TTL } from "./countries.js";

const START_CREDITS = 3;

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
  profile = loadLocal(u.uid);
  renderCredits();
  renderCountries();
  renderLocalNumbers();
  try {
    await update(ref(db, `users/${u.uid}`), {
      email: u.email || "",
      displayName: u.displayName || "",
      credits: profile.credits,
    });
  } catch (_) {}
});

$("outBtn").onclick = () => signOut(auth);
$("searchC").oninput = () => renderCountries($("searchC").value);
$("genBtn").onclick = generate;
$("copyPhone").onclick = () => copy(activeNumber?.e164, "Номер скопирован");
$("copyCode").onclick = () => copy(String($("codeView").textContent || "").replace(/\D/g, ""), "Код скопирован");

function storageKey(uid) {
  return `black_profile_v3_${uid}`;
}

function loadLocal(uid) {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.credits = Number(parsed.credits);
      if (!Number.isFinite(parsed.credits)) parsed.credits = START_CREDITS;
      parsed.numbers = parsed.numbers || [];
      return parsed;
    }
  } catch (_) {}
  return { credits: START_CREDITS, numbers: [] };
}

function saveLocal() {
  if (!user) return;
  localStorage.setItem(storageKey(user.uid), JSON.stringify(profile));
}

function renderCredits() {
  const n = Number(profile.credits || 0);
  if ($("creditsVal")) $("creditsVal").textContent = String(n);
  const mail = user?.email || "";
  if ($("who")) {
    $("who").innerHTML = mail
      ? `<span>${mail}</span><span class="bal-pill">баланс ${n}</span>`
      : `<span class="bal-pill">баланс ${n}</span>`;
  }
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
      c.paid ? '<span class="paid">3 очка</span>' : "<span>1 очко</span>"
    }`;
    el.onclick = () => {
      selected = c;
      renderCountries($("searchC").value);
    };
    box.appendChild(el);
  });
}

function generate() {
  const msg = $("genMsg");
  msg.className = "msg";
  if (!selected) selected = COUNTRIES.find((c) => c.iso === "RU") || COUNTRIES[1];

  const cost = selected.paid ? 3 : 1;
  if (Number(profile.credits || 0) < cost) {
    msg.className = "msg err";
    msg.textContent = `Не хватает очков. Нужно ${cost}, у тебя ${profile.credits}. Стартовый баланс — 3.`;
    return;
  }

  const local = randomDigits(selected.len);
  const e164 = formatE164(selected.dial, local);
  const now = Date.now();
  const rec = {
    e164,
    iso: selected.iso,
    country: selected.name,
    dial: selected.dial,
    paid: !!selected.paid,
    ownerUid: user?.uid || "local",
    ownerEmail: user?.email || "",
    currentCode: codeFor(e164, now),
    updatedAt: now,
    expiresAt: Math.floor(now / CODE_TTL) * CODE_TTL + CODE_TTL,
    createdAt: now,
  };

  profile.credits = Number(profile.credits) - cost;
  profile.numbers = [{ e164, country: selected.name, createdAt: now }, ...(profile.numbers || [])].slice(0, 20);
  saveNumber(rec);
  saveLocal();
  renderCredits();
  setActive(rec);
  renderLocalNumbers();

  msg.className = "msg ok";
  msg.textContent = `Номер выпущен: ${prettyPhone(e164)}. Осталось ${profile.credits} оч.`;

  if (user) {
    set(ref(db, `virtualNumbers/${sanitize(e164)}`), rec).catch(() => {});
    update(ref(db, `users/${user.uid}`), { credits: profile.credits }).catch(() => {});
    push(ref(db, `users/${user.uid}/numbers`), { e164, country: selected.name, createdAt: now }).catch(() => {});
  }
}

function renderLocalNumbers() {
  const items = profile.numbers || [];
  $("myNumbers").innerHTML =
    items
      .slice(0, 8)
      .map(
        (n) =>
          `<div class="row"><span>${prettyPhone(n.e164)}<br/><small style="color:var(--muted)">${n.country || ""}</small></span><button class="btn btn-ghost" data-open="${n.e164}">Открыть</button></div>`
      )
      .join("") || `<div class="row"><span>Пока нет номеров</span></div>`;
  $("myNumbers").querySelectorAll("[data-open]").forEach((btn) => {
    btn.onclick = () => {
      const e164 = btn.dataset.open;
      try {
        const raw = localStorage.getItem(`black_virtual_${sanitize(e164)}`);
        if (raw) {
          setActive(JSON.parse(raw));
          return;
        }
      } catch (_) {}
      setActive({
        e164,
        country: items.find((x) => x.e164 === e164)?.country || "",
        paid: String(e164).startsWith("+888"),
        currentCode: codeFor(e164),
        expiresAt: Math.floor(Date.now() / CODE_TTL) * CODE_TTL + CODE_TTL,
      });
    };
  });
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

function rotateIfNeeded() {
  if (!activeNumber) return;
  const now = Date.now();
  const next = Math.floor(now / CODE_TTL) * CODE_TTL + CODE_TTL;
  const code = codeFor(activeNumber.e164, now);
  if (activeNumber.currentCode !== code) {
    activeNumber = {
      ...activeNumber,
      currentCode: code,
      updatedAt: now,
      expiresAt: next,
    };
    saveNumber(activeNumber);
    if (user) {
      update(ref(db, `virtualNumbers/${sanitize(activeNumber.e164)}`), {
        currentCode: code,
        updatedAt: now,
        expiresAt: next,
      }).catch(() => {});
    }
  }
  activeNumber.expiresAt = next;
  const left = Math.max(0, (activeNumber.expiresAt || now) - now);
  $("codeView").textContent = code;
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
  if (!text || String(text).includes("•")) return;
  try {
    await navigator.clipboard.writeText(text);
    $("genMsg").className = "msg ok";
    $("genMsg").textContent = ok;
  } catch {
    $("genMsg").className = "msg";
    $("genMsg").textContent = text;
  }
}
