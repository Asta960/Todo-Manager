import { state } from "../state.js";
import { els } from "../dom.js";

let inited = false;
let host = null;
let stack = null;
let lastId = null;
let activeToast = null;
let activeBig = null;
let activeSub = null;
let activeOutTimer = null;
let activeRemoveTimer = null;
let comboCount = 0;
let comboTagId = null;
let burstLayer = null;
let suppressed = false;

const DAILY_TOAST_SHOWN_PREFIX = "dailyXpToastShown:";

function wasDailyToastShown(sourceId) {
  if (!sourceId) return false;
  try {
    return localStorage.getItem(`${DAILY_TOAST_SHOWN_PREFIX}${sourceId}`) === "1";
  } catch {
    return false;
  }
}

function markDailyToastShown(sourceId) {
  if (!sourceId) return;
  try {
    localStorage.setItem(`${DAILY_TOAST_SHOWN_PREFIX}${sourceId}`, "1");
  } catch {
    /* ignore */
  }
}

function clearToastsNow() {
  if (activeOutTimer) window.clearTimeout(activeOutTimer);
  if (activeRemoveTimer) window.clearTimeout(activeRemoveTimer);
  activeOutTimer = null;
  activeRemoveTimer = null;
  comboCount = 0;
  comboTagId = null;
  activeToast = null;
  activeBig = null;
  activeSub = null;
  if (stack) stack.innerHTML = "";
}

function ensureHost() {
  if (host && stack) return;
  host = document.createElement("div");
  host.className = "xp-toast-host";
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-relevant", "additions");

  stack = document.createElement("div");
  stack.className = "xp-toast-stack";
  host.appendChild(stack);
  const content = document.querySelector(".content") || document.body;
  content.appendChild(host);
}

function ensureBurstLayer() {
  if (burstLayer) return;
  burstLayer = document.createElement("div");
  burstLayer.className = "xp-toast-burst";
  const content = document.querySelector(".content") || document.body;
  content.appendChild(burstLayer);
}

function positionOverlayToContent() {
  if (!burstLayer) return;
  const viewKey = state?.currentView;
  const viewEl = viewKey && els?.views ? els.views[viewKey] : null;
  const target = viewEl?.getBoundingClientRect ? viewEl : els?.contentScroll;
  if (!target?.getBoundingClientRect) {
    burstLayer.style.left = "0px";
    burstLayer.style.right = "0px";
    burstLayer.style.top = "0px";
    burstLayer.style.bottom = "0px";
    return;
  }
  const r = target.getBoundingClientRect();
  burstLayer.style.left = `${Math.max(0, Math.floor(r.left))}px`;
  burstLayer.style.right = `${Math.max(0, Math.floor(window.innerWidth - r.right))}px`;
  burstLayer.style.top = `${Math.max(0, Math.floor(r.top))}px`;
  burstLayer.style.bottom = "0px";
}

function positionHostToContent() {
  if (!host) return;
  const viewKey = state?.currentView;
  const viewEl = viewKey && els?.views ? els.views[viewKey] : null;
  const target = viewEl?.getBoundingClientRect ? viewEl : els?.contentScroll;
  if (!target?.getBoundingClientRect) {
    host.style.setProperty("--xp-toast-left", "12px");
    host.style.setProperty("--xp-toast-right", "12px");
    host.style.setProperty("--xp-toast-bottom", "18px");
    return;
  }
  const r = target.getBoundingClientRect();
  const pad = 22;
  const left = Math.max(8, Math.floor(r.left + pad));
  const right = Math.max(8, Math.floor(window.innerWidth - r.right + pad));
  // Stick to viewport bottom always (but horizontally clipped to content container).
  // The old formula moved it up when the view was short.
  const bottom = 18;
  host.style.setProperty("--xp-toast-left", `${left}px`);
  host.style.setProperty("--xp-toast-right", `${right}px`);
  host.style.setProperty("--xp-toast-bottom", `${bottom}px`);
}

function tagTitle(tagId) {
  if (!tagId) return null;
  const tag = state.data?.tags?.find((t) => t.id === tagId);
  return tag?.title ? String(tag.title) : null;
}

function fireSparkles(root, intensity = 1) {
  const sparkleCount = Math.max(5, Math.min(26, 6 + intensity * 5));
  for (let i = 0; i < sparkleCount; i += 1) {
    const sp = document.createElement("span");
    sp.className = "xp-toast-sparkle";
    sp.style.left = `${10 + Math.random() * 80}%`;
    sp.style.animationDelay = `${Math.random() * 0.09}s`;
    const spread = 26 + intensity * 9;
    sp.style.setProperty("--dx", `${-spread + Math.random() * (spread * 2)}px`);
    sp.style.setProperty("--dy", `${-(30 + intensity * 8) - Math.random() * (18 + intensity * 6)}px`);
    sp.style.setProperty("--rot", `${-60 + Math.random() * 120}deg`);
    root.appendChild(sp);
  }
}

function fireMegaBurst() {
  ensureBurstLayer();
  positionOverlayToContent();
  burstLayer.innerHTML = "";

  const r = burstLayer.getBoundingClientRect();
  const rightEdge = Math.floor(r.width - 26);
  const bottomEdge = Math.floor(r.height - 18);

  const count = 70;
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement("span");
    p.className = "xp-toast-burst-particle";
    const startX = rightEdge - Math.random() * 220;
    const startY = bottomEdge - Math.random() * 120;
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    p.style.animationDelay = `${Math.random() * 0.08}s`;
    p.style.setProperty("--dx", `${-80 + Math.random() * 160}px`);
    p.style.setProperty("--dy", `${-240 - Math.random() * 260}px`);
    p.style.setProperty("--rot", `${-140 + Math.random() * 280}deg`);
    burstLayer.appendChild(p);
  }

  window.setTimeout(() => {
    if (burstLayer) burstLayer.innerHTML = "";
  }, 1100);
}

function setComboClass(toast, n) {
  toast.classList.remove("xp-toast--combo2", "xp-toast--combo3", "xp-toast--combo4", "xp-toast--mega");
  if (n >= 5) toast.classList.add("xp-toast--mega");
  else if (n === 4) toast.classList.add("xp-toast--combo4");
  else if (n === 3) toast.classList.add("xp-toast--combo3");
  else if (n === 2) toast.classList.add("xp-toast--combo2");
}

function bumpAnimation(toast) {
  // restart combo animation by reflow (doesn't touch opacity)
  toast.classList.remove("xp-toast--combo2", "xp-toast--combo3", "xp-toast--combo4", "xp-toast--mega");
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight;
  setComboClass(toast, comboCount);
}

function scheduleRemove(toast, ttl = 1650) {
  if (activeOutTimer) window.clearTimeout(activeOutTimer);
  if (activeRemoveTimer) window.clearTimeout(activeRemoveTimer);
  activeOutTimer = window.setTimeout(() => {
    toast.classList.add("xp-toast--out");
    activeRemoveTimer = window.setTimeout(() => {
      if (toast === activeToast) {
        activeToast = null;
        activeBig = null;
        activeSub = null;
        comboCount = 0;
        comboTagId = null;
      }
      toast.remove();
    }, 380);
  }, ttl);
}

function showXpToast(evt) {
  if (suppressed) return;
  if (!evt || evt.type !== "xp_gain") return;
  if (evt.id && evt.id === lastId) return;
  lastId = evt.id || null;

  // Daily: allow XP changes, but show the +XP toast only once per template per day.
  // `sourceId` is `${templateId}:${dateKey}` from toggleDailyDone.
  const reason = evt.payload?.reason || null;
  const sourceId = evt.payload?.sourceId || null;
  if (reason === "daily_done_toggle" && sourceId) {
    if (wasDailyToastShown(sourceId)) return;
    markDailyToastShown(sourceId);
  }

  ensureHost();
  positionHostToContent();

  const delta = Math.trunc(evt.payload?.delta || 0);
  if (!delta) return;

  const tagId = evt.payload?.tagId || null;
  const tag = tagTitle(tagId);

  const canCombo = Boolean(activeToast);
  if (canCombo) {
    // if toast started to disappear, revive it (no gap)
    if (activeToast.classList.contains("xp-toast--out")) {
      activeToast.classList.remove("xp-toast--out");
    }
    comboCount += Math.max(1, delta);
    comboTagId = tagId || comboTagId;
    const tName = tagTitle(comboTagId);
    setComboClass(activeToast, comboCount);
    const label =
      comboCount >= 5
        ? `Невозможно!!! +${comboCount} XP`
        : `+${comboCount} XP`;
    if (activeBig) activeBig.textContent = label;
    if (activeSub) activeSub.textContent = tName ? `#${tName} • комбо x${comboCount}` : `комбо x${comboCount}`;
    fireSparkles(activeToast, Math.min(6, comboCount));
    if (comboCount >= 5) fireMegaBurst();
    bumpAnimation(activeToast);
    scheduleRemove(activeToast, 1650 + Math.min(900, comboCount * 120));
    return;
  }

  comboCount = Math.max(1, delta);
  comboTagId = tagId;

  const toast = document.createElement("div");
  toast.className = "xp-toast xp-toast--enter xp-toast--gain";
  toast.setAttribute("role", "status");

  const glow = document.createElement("div");
  glow.className = "xp-toast-glow";
  toast.appendChild(glow);

  const inner = document.createElement("div");
  inner.className = "xp-toast-inner";

  const big = document.createElement("div");
  big.className = "xp-toast-big";
  big.textContent = `+${comboCount} XP`;

  const sub = document.createElement("div");
  sub.className = "xp-toast-sub";
  sub.textContent = tag ? `#${tag}` : "без тега";

  inner.appendChild(big);
  inner.appendChild(sub);
  toast.appendChild(inner);

  fireSparkles(toast, 1);
  stack.prepend(toast);
  while (stack.children.length > 2) stack.lastElementChild.remove();

  window.setTimeout(() => toast.classList.remove("xp-toast--enter"), 520);

  activeToast = toast;
  activeBig = big;
  activeSub = sub;
  setComboClass(toast, 1);

  scheduleRemove(toast, 1650);
}

export function initXpToasts() {
  if (inited) return;
  inited = true;

  ensureHost();
  ensureBurstLayer();
  positionHostToContent();
  positionOverlayToContent();
  window.addEventListener("resize", () => {
    positionHostToContent();
    positionOverlayToContent();
  });
  window.addEventListener("scroll", () => {
    positionHostToContent();
    positionOverlayToContent();
  }, { passive: true });
  els?.contentScroll?.addEventListener?.("scroll", () => {
    positionHostToContent();
    positionOverlayToContent();
  }, { passive: true });

  window.addEventListener("app:event", (e) => {
    const evt = e?.detail;
    showXpToast(evt);
  });

  window.addEventListener("levelup:show", () => {
    suppressed = true;
    clearToastsNow();
  });
  window.addEventListener("levelup:hide", () => {
    suppressed = false;
  });
}

