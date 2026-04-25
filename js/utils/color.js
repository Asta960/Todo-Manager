export function getAccentHex() {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#E3B57D";
}

export function hexToRgb(hex) {
  const raw = String(hex || "").trim();
  const m = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return { r: 227, g: 181, b: 125 };
  const h = m[1];
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function setAccent(hex) {
  document.documentElement.style.setProperty("--accent", hex);
}
