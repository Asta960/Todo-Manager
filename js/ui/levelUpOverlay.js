import { state } from "../state.js";
import { els } from "../dom.js";
import { levelFromXp } from "../motivation/xp.js";

let inited = false;
let lastLevel = null;
let overlay = null;
let animRaf = 0;
let animStartAt = 0;
let animDurationMs = 1600;
let animRing = null;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "levelup-overlay is-hidden";
  overlay.setAttribute("aria-hidden", "true");

  overlay.innerHTML = `
    <div class="levelup-backdrop"></div>
    <div class="levelup-stage" role="dialog" aria-label="Повышение уровня">
      <div class="levelup-ring" style="--levelup-pct: 0">
        <div class="levelup-ring-inner">
          <div class="levelup-num levelup-num--old" id="levelUpOldNum">0</div>
          <div class="levelup-num levelup-num--new" id="levelUpNewNum">1</div>
        </div>
      </div>
      <div class="levelup-label" aria-hidden="true">LEVEL UP</div>
    </div>
  `;

  // Attach into content so sidebar is not covered
  const content = document.querySelector(".content") || document.body;
  content.appendChild(overlay);
  return overlay;
}

function stopRingAnim() {
  if (animRaf) cancelAnimationFrame(animRaf);
  animRaf = 0;
  animStartAt = 0;
  animRing = null;
}

function startRingFill(ringEl, durationMs = 1600) {
  stopRingAnim();
  animRing = ringEl;
  animDurationMs = Math.max(520, Math.min(2200, Math.trunc(durationMs)));
  animStartAt = performance.now();

  const step = (now) => {
    if (!animRing) return;
    const t = (now - animStartAt) / animDurationMs;
    const v = Math.max(0, Math.min(1, t));
    animRing.style.setProperty("--levelup-pct", String(v));
    if (t >= 1) {
      animRing.style.setProperty("--levelup-pct", "1");
      stopRingAnim();
      return;
    }
    animRaf = requestAnimationFrame(step);
  };
  animRaf = requestAnimationFrame(step);
}

function showLevelUp(oldLvl, newLvl) {
  const root = ensureOverlay();
  root.classList.remove("is-hidden");
  root.setAttribute("aria-hidden", "false");
  if (typeof window !== "undefined" && window?.dispatchEvent && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent("levelup:show"));
  }

  const ring = root.querySelector(".levelup-ring");
  const oldEl = root.querySelector("#levelUpOldNum");
  const newEl = root.querySelector("#levelUpNewNum");
  if (oldEl) oldEl.textContent = String(oldLvl);
  if (newEl) newEl.textContent = String(newLvl);
  if (ring) ring.style.setProperty("--levelup-pct", "0");

  // reset animation state
  root.classList.remove("levelup-play", "levelup-swapped", "levelup-out", "levelup-complete");
  // eslint-disable-next-line no-unused-expressions
  root.offsetHeight;
  root.classList.add("levelup-play");

  // timeline (<= 5s)
  window.setTimeout(() => {
    if (ring) startRingFill(ring, 1050);
  }, 650);

  window.setTimeout(() => {
    root.classList.add("levelup-complete");
  }, 2450);

  window.setTimeout(() => {
    root.classList.add("levelup-swapped");
  }, 2850);

  window.setTimeout(() => {
    root.classList.add("levelup-out");
  }, 4100);

  window.setTimeout(() => {
    root.classList.add("is-hidden");
    root.classList.remove("levelup-play", "levelup-swapped", "levelup-out", "levelup-complete");
    if (ring) ring.style.setProperty("--levelup-pct", "0");
    root.setAttribute("aria-hidden", "true");
    stopRingAnim();
    if (typeof window !== "undefined" && window?.dispatchEvent && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(new CustomEvent("levelup:hide"));
    }
  }, 4700);
}

function maybeTriggerLevelUp() {
  const xp = Math.max(0, Math.trunc(state.data?.motivation?.totalXp || 0));
  const lvl = levelFromXp(xp);
  if (lastLevel == null) {
    lastLevel = lvl;
    return;
  }
  if (lvl > lastLevel) {
    const old = lastLevel;
    lastLevel = lvl;
    showLevelUp(old, lvl);
    return;
  }
  lastLevel = lvl;
}

export function initLevelUpOverlay() {
  if (inited) return;
  inited = true;
  ensureOverlay();
  maybeTriggerLevelUp();

  window.addEventListener("app:event", (e) => {
    const evt = e?.detail;
    if (!evt) return;
    if (evt.type !== "xp_gain" && evt.type !== "xp_spend") return;
    maybeTriggerLevelUp();
  });
}

