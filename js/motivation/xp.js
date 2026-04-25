import { state } from "../state.js";
import { pushEvent } from "../data/events.js";

export function triangular(n) {
  return (n * (n + 1)) / 2;
}

export function levelFromXp(xp) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  let l = 0;
  while (triangular(l + 1) <= safeXp) l += 1;
  return l;
}

export function xpToNextLevel(xp) {
  const lvl = levelFromXp(xp);
  const nextReq = triangular(lvl + 1);
  return { level: lvl, nextReq, current: Math.max(0, Math.floor(Number(xp) || 0)) };
}

export function addXp(tagId, delta, reason, sourceId) {
  if (!tagId) return;
  const d = Math.trunc(delta);
  if (!d) return;
  const points = state.data.motivation.tagPoints;
  const prev = Math.max(0, Math.trunc(points[tagId] || 0));
  const next = Math.max(0, prev + d);
  const applied = next - prev;
  if (!applied) return;
  points[tagId] = next;
  state.data.motivation.totalXp = Math.max(0, Math.trunc(state.data.motivation.totalXp || 0) + applied);
  pushEvent(applied > 0 ? "xp_gain" : "xp_spend", { tagId, delta: applied, reason, sourceId });
}
