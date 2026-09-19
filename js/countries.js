export const COUNTRIES = [
  { iso: "ANON", name: "Анонимный", dial: "888", flag: "◈", paid: true, len: 8 },
  { iso: "RU", name: "Россия", dial: "7", flag: "🇷🇺", paid: false, len: 10 },
  { iso: "UA", name: "Украина", dial: "380", flag: "🇺🇦", paid: false, len: 9 },
  { iso: "BY", name: "Беларусь", dial: "375", flag: "🇧🇾", paid: false, len: 9 },
  { iso: "KZ", name: "Казахстан", dial: "7", flag: "🇰🇿", paid: false, len: 10 },
  { iso: "US", name: "США", dial: "1", flag: "🇺🇸", paid: false, len: 10 },
  { iso: "GB", name: "Великобритания", dial: "44", flag: "🇬🇧", paid: false, len: 10 },
  { iso: "DE", name: "Германия", dial: "49", flag: "🇩🇪", paid: false, len: 11 },
  { iso: "FR", name: "Франция", dial: "33", flag: "🇫🇷", paid: false, len: 9 },
  { iso: "IT", name: "Италия", dial: "39", flag: "🇮🇹", paid: false, len: 10 },
  { iso: "ES", name: "Испания", dial: "34", flag: "🇪🇸", paid: false, len: 9 },
  { iso: "PL", name: "Польша", dial: "48", flag: "🇵🇱", paid: false, len: 9 },
  { iso: "TR", name: "Турция", dial: "90", flag: "🇹🇷", paid: false, len: 10 },
  { iso: "IN", name: "Индия", dial: "91", flag: "🇮🇳", paid: false, len: 10 },
  { iso: "CN", name: "Китай", dial: "86", flag: "🇨🇳", paid: false, len: 11 },
  { iso: "JP", name: "Япония", dial: "81", flag: "🇯🇵", paid: false, len: 10 },
  { iso: "KR", name: "Южная Корея", dial: "82", flag: "🇰🇷", paid: false, len: 10 },
  { iso: "BR", name: "Бразилия", dial: "55", flag: "🇧🇷", paid: false, len: 11 },
  { iso: "MX", name: "Мексика", dial: "52", flag: "🇲🇽", paid: false, len: 10 },
  { iso: "CA", name: "Канада", dial: "1", flag: "🇨🇦", paid: false, len: 10 },
  { iso: "AU", name: "Австралия", dial: "61", flag: "🇦🇺", paid: false, len: 9 },
  { iso: "NL", name: "Нидерланды", dial: "31", flag: "🇳🇱", paid: false, len: 9 },
  { iso: "SE", name: "Швеция", dial: "46", flag: "🇸🇪", paid: false, len: 9 },
  { iso: "NO", name: "Норвегия", dial: "47", flag: "🇳🇴", paid: false, len: 8 },
  { iso: "FI", name: "Финляндия", dial: "358", flag: "🇫🇮", paid: false, len: 9 },
  { iso: "CH", name: "Швейцария", dial: "41", flag: "🇨🇭", paid: false, len: 9 },
  { iso: "AT", name: "Австрия", dial: "43", flag: "🇦🇹", paid: false, len: 10 },
  { iso: "CZ", name: "Чехия", dial: "420", flag: "🇨🇿", paid: false, len: 9 },
  { iso: "AE", name: "ОАЭ", dial: "971", flag: "🇦🇪", paid: false, len: 9 },
  { iso: "IL", name: "Израиль", dial: "972", flag: "🇮🇱", paid: false, len: 9 },
  { iso: "EG", name: "Египет", dial: "20", flag: "🇪🇬", paid: false, len: 10 },
  { iso: "ZA", name: "ЮАР", dial: "27", flag: "🇿🇦", paid: false, len: 9 },
  { iso: "NG", name: "Нигерия", dial: "234", flag: "🇳🇬", paid: false, len: 10 },
  { iso: "AR", name: "Аргентина", dial: "54", flag: "🇦🇷", paid: false, len: 10 },
  { iso: "ID", name: "Индонезия", dial: "62", flag: "🇮🇩", paid: false, len: 11 },
  { iso: "TH", name: "Таиланд", dial: "66", flag: "🇹🇭", paid: false, len: 9 },
  { iso: "VN", name: "Вьетнам", dial: "84", flag: "🇻🇳", paid: false, len: 9 },
  { iso: "PH", name: "Филиппины", dial: "63", flag: "🇵🇭", paid: false, len: 10 },
  { iso: "SG", name: "Сингапур", dial: "65", flag: "🇸🇬", paid: false, len: 8 },
  { iso: "NZ", name: "Новая Зеландия", dial: "64", flag: "🇳🇿", paid: false, len: 9 },
  { iso: "PT", name: "Португалия", dial: "351", flag: "🇵🇹", paid: false, len: 9 },
  { iso: "GR", name: "Греция", dial: "30", flag: "🇬🇷", paid: false, len: 10 },
  { iso: "RO", name: "Румыния", dial: "40", flag: "🇷🇴", paid: false, len: 9 },
  { iso: "HU", name: "Венгрия", dial: "36", flag: "🇭🇺", paid: false, len: 9 },
  { iso: "GE", name: "Грузия", dial: "995", flag: "🇬🇪", paid: false, len: 9 },
  { iso: "AM", name: "Армения", dial: "374", flag: "🇦🇲", paid: false, len: 8 },
  { iso: "AZ", name: "Азербайджан", dial: "994", flag: "🇦🇿", paid: false, len: 9 },
  { iso: "UZ", name: "Узбекистан", dial: "998", flag: "🇺🇿", paid: false, len: 9 },
  { iso: "MD", name: "Молдова", dial: "373", flag: "🇲🇩", paid: false, len: 8 },
];

export function randomDigits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  if (s[0] === "0") s = String(1 + Math.floor(Math.random() * 9)) + s.slice(1);
  return s;
}

export function formatE164(dial, local) {
  return `+${dial}${local}`;
}

export function formatLocal(digits, len = 10) {
  const d = String(digits || "").replace(/\D/g, "").slice(0, len);
  if (len <= 8) return d.replace(/(\d{4})(\d+)/, "$1 $2").trim();
  if (len === 9) return d.replace(/(\d{3})(\d{3})(\d+)/, "$1 $2 $3").trim();
  if (len === 11) return d.replace(/(\d{3})(\d{4})(\d+)/, "$1 $2 $3").trim();
  return d.replace(/(\d{3})(\d{3})(\d+)/, "$1 $2 $3").trim();
}

export function prettyPhone(e164) {
  if (!e164) return "";
  const d = e164.replace(/[^\d+]/g, "");
  if (d.startsWith("+888")) return d.replace(/(\+888)(\d{4})(\d+)/, "$1 $2 $3");
  if (d.length > 8) return d.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d+)/, "$1 $2 $3 $4");
  return d;
}

export function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const CODE_TTL = 20000;
const CODE_SEED = "BLACK-OTP-7k3";

export function codeSlot(at = Date.now()) {
  return Math.floor(at / CODE_TTL);
}

export function codeFor(e164, at = Date.now()) {
  const s = `${CODE_SEED}|${String(e164).replace(/\s/g, "")}|${codeSlot(at)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(h >>> 0).slice(-6).padStart(6, "0");
}

export function phoneVariants(e164) {
  const d = String(e164 || "").replace(/\D/g, "");
  return [...new Set([
    String(e164 || "").replace(/\s/g, ""),
    `+${d}`,
    `+888${d.slice(-8)}`,
    `+7${d.slice(-10)}`,
  ])];
}

export function codeValid(e164, code) {
  const want = String(code || "").replace(/\D/g, "");
  if (want.length !== 6) return false;
  const now = Date.now();
  for (const p of phoneVariants(e164)) {
    for (let i = -20; i <= 20; i++) {
      if (codeFor(p, now + i * CODE_TTL) === want) return true;
    }
  }
  return false;
}

export { CODE_TTL };
