import { SCHEMA_VERSION } from "../constants.js";
import { nowIso, todayKey } from "../utils/time.js";
import { cryptoRandomId } from "../utils/id.js";

export function ensureDataShapeV3(data) {
  const safe = data && typeof data === "object" ? data : {};
  safe.meta = safe.meta || { createdAt: nowIso(), lastActiveDate: todayKey(), schemaVersion: SCHEMA_VERSION };
  safe.meta.createdAt = safe.meta.createdAt || nowIso();
  safe.meta.lastActiveDate = safe.meta.lastActiveDate || todayKey();
  safe.meta.schemaVersion = SCHEMA_VERSION;

  safe.settings = safe.settings || { autosave: true, accent: "#E3B57D" };
  if (typeof safe.settings.autosave !== "boolean") safe.settings.autosave = true;
  if (!safe.settings.accent) safe.settings.accent = "#E3B57D";

  safe.taskGroups = Array.isArray(safe.taskGroups) ? safe.taskGroups : [];
  safe.taskGroups = safe.taskGroups.map((g, i) => {
    const id = g && typeof g.id === "string" && g.id.trim() ? g.id.trim() : cryptoRandomId();
    return {
      id,
      title: g && g.title != null ? String(g.title).trim() || "Группа" : "Группа",
      order: Number.isFinite(g?.order) ? g.order : i
    };
  });
  safe.taskGroups.sort((a, b) => a.order - b.order);

  safe.inbox = Array.isArray(safe.inbox) ? safe.inbox : [];
  safe.tasks = Array.isArray(safe.tasks) ? safe.tasks : [];

  const groupIds = new Set(safe.taskGroups.map((g) => g.id));
  const normGroupId = (gid) => (gid && typeof gid === "string" && groupIds.has(gid) ? gid : null);

  safe.inbox.forEach((item) => {
    if (item && typeof item === "object") {
      item.groupId = normGroupId(item.groupId);
    }
  });
  safe.tasks.forEach((t) => {
    if (t && typeof t === "object") {
      t.groupId = normGroupId(t.groupId);
    }
  });
  safe.projects = Array.isArray(safe.projects) ? safe.projects : [];
  safe.tags = Array.isArray(safe.tags) ? safe.tags : [];
  const tagIdSet = new Set(safe.tags.map((t) => (t && typeof t.id === "string" ? t.id : "")).filter(Boolean));
  safe.projects.forEach((p) => {
    if (p && typeof p === "object") {
      const tid = p.tagId;
      p.tagId = tid && typeof tid === "string" && tagIdSet.has(tid) ? tid : null;
    }
  });
  safe.motivation = safe.motivation && typeof safe.motivation === "object" ? safe.motivation : {};
  safe.motivation.tagPoints =
    safe.motivation.tagPoints && typeof safe.motivation.tagPoints === "object" ? safe.motivation.tagPoints : {};
  safe.motivation.totalXp = Number.isFinite(safe.motivation.totalXp) ? safe.motivation.totalXp : 0;
  safe.dailyTemplates = Array.isArray(safe.dailyTemplates) ? safe.dailyTemplates : [];
  safe.dailyTemplates.forEach((t) => {
    if (t && typeof t === "object") {
      const tid = t.tagId;
      t.tagId = tid && typeof tid === "string" && tagIdSet.has(tid) ? tid : null;
    }
  });
  safe.dailyStateByDate = safe.dailyStateByDate && typeof safe.dailyStateByDate === "object" ? safe.dailyStateByDate : {};
  delete safe.events;

  safe.tasks.forEach((t) => {
    if (t && typeof t === "object") {
      delete t.deadlineAt;
      delete t.remindAt;
      delete t.scheduledAt;
      if (t.status === "cancelled") t.status = "next";
    }
  });

  const today = todayKey();
  if (!safe.dailyStateByDate[today]) {
    safe.dailyStateByDate[today] = safe.dailyTemplates.map((t) => ({
      templateId: t.id,
      titleSnapshot: t.title,
      done: false
    }));
  } else {
    const list = Array.isArray(safe.dailyStateByDate[today]) ? safe.dailyStateByDate[today] : [];
    const byId = new Map(list.map((x) => [x.templateId, x]));
    safe.dailyTemplates.forEach((t) => {
      if (!byId.has(t.id)) {
        list.push({ templateId: t.id, titleSnapshot: t.title, done: false });
      }
    });
    const templateIds = new Set(safe.dailyTemplates.map((t) => t.id));
    safe.dailyStateByDate[today] = list.filter((x) => templateIds.has(x.templateId));
  }
  return safe;
}
