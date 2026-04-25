import { state } from "../state.js";
import { getAccentHex, hexToRgb } from "../utils/color.js";

const LABEL_PAD = 26;

export function syncCanvasSize(canvas, cssHeight = 280) {
  if (!canvas) return { w: 0, h: 0, dpr: 1 };
  const wrap = canvas.parentElement;
  const wCss = Math.max(200, Math.floor((wrap ? wrap.clientWidth : canvas.clientWidth) - 8));
  const hCss = cssHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(wCss * dpr));
  canvas.height = Math.max(1, Math.floor(hCss * dpr));
  canvas.style.width = `${wCss}px`;
  canvas.style.height = `${hCss}px`;
  return { w: wCss, h: hCss, dpr };
}

export function drawRadar(canvas, tags, values) {
  const { w, h, dpr } = syncCanvasSize(canvas, 280);
  if (!canvas || !w || !h) return;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const n = tags.length;
  if (n < 3) {
    ctx.fillStyle = "#8e8e93";
    ctx.font = "13px Inter, Segoe UI, system-ui, sans-serif";
    ctx.fillText("Создай хотя бы 3 тега для диаграммы.", 12, 24);
    return;
  }

  const cx = w / 2;
  const cy = h / 2;
  const rBase = Math.min(w, h) / 2 - LABEL_PAD;
  const radius = Math.max(40, rBase * 0.72 * Math.max(0.6, Math.min(1.8, state.radarZoom || 1)));

  const maxVal = Math.max(1, ...values);
  const rings = 5;
  const { r, g, b } = hexToRgb(getAccentHex());

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= rings; ring += 1) {
    const rr = (radius * ring) / rings;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  for (let i = 0; i < n; i += 1) {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
    ctx.stroke();
  }

  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const v = Math.max(0, values[i] || 0);
    const rr = radius * (v / maxVal);
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();

  ctx.font = "12px Inter, Segoe UI, system-ui, sans-serif";
  const labelR = radius + 14;
  tags.forEach((t, i) => {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a);
    const text = String(t.title || "").length > 20 ? `${String(t.title).slice(0, 20)}…` : String(t.title || "");
    const metrics = ctx.measureText(text);
    const halfW = metrics.width / 2;
    let tx = x - halfW;
    let ty = y + 4;
    if (Math.abs(Math.cos(a)) < 0.15) {
      ty = y + (Math.sin(a) > 0 ? 14 : -6);
    }
    tx = Math.max(4, Math.min(w - metrics.width - 4, tx));
    ty = Math.max(14, Math.min(h - 4, ty));
    ctx.fillStyle = "rgba(200, 200, 204, 0.95)";
    ctx.fillText(text, tx, ty);
  });
}
