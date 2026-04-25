import { state } from "../state.js";
import { nowIso, todayKey } from "../utils/time.js";
import { addXp } from "../motivation/xp.js";
import { pushEvent } from "../data/events.js";
import { persist } from "../data/persist.js";
import { renderAll } from "../renderLoop.js";

export function getTodayDailyItems() {
  const key = todayKey();
  const list = state.data.dailyStateByDate[key] || [];
  return { key, list };
}

export async function toggleDailyDone(templateId) {
  const { key, list } = getTodayDailyItems();
  const item = list.find((x) => x.templateId === templateId);
  if (!item) return;
  item.done = !item.done;
  item.doneAt = item.done ? nowIso() : undefined;
  const template = state.data.dailyTemplates.find((t) => t.id === templateId);
  const xpTagId = template?.tagId || null;
  addXp(xpTagId, item.done ? 1 : -1, "daily_done_toggle", `${templateId}:${key}`);
  pushEvent(item.done ? "daily_done" : "daily_undone", {
    templateId,
    dateKey: key,
    tagId: xpTagId
  });
  await persist();
  renderAll();
}

export function createDailyTodayRow(item) {
  const template = state.data.dailyTemplates.find((x) => x.id === item.templateId);
  const tag = template?.tagId ? state.data.tags.find((x) => x.id === template.tagId) : null;
  const row = document.createElement("div");
  row.className = `task-item ${item.done ? "done" : ""}`;
  const body = document.createElement("div");
  body.className = "task-body";
  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = item.titleSnapshot;
  body.appendChild(title);
  const actions = document.createElement("div");
  actions.className = "task-actions";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = tag ? `#${tag.title}` : "—";
  actions.appendChild(badge);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-accent";
  btn.textContent = item.done ? "Снять" : "Готово";
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await toggleDailyDone(item.templateId);
  });
  actions.appendChild(btn);
  row.appendChild(body);
  row.appendChild(actions);
  row.addEventListener("click", () => toggleDailyDone(item.templateId));
  return row;
}
