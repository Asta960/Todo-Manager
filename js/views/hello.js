import { state } from "../state.js";
import { els } from "../dom.js";
import { xpToNextLevel, triangular } from "../motivation/xp.js";
import { drawRadar } from "../ui/radar.js";
import { makeTaskRow } from "../components/taskRows.js";
import { getTodayDailyItems, createDailyTodayRow } from "../daily/helpers.js";

const TAG_STATS_EXPANDED_KEY = "helloTagStatsExpanded";

function readTagStatsExpanded() {
  try {
    const v = localStorage.getItem(TAG_STATS_EXPANDED_KEY);
    if (v === "true" || v === "1") return true;
  } catch (_) {
    /* ignore */
  }
  return false;
}

function writeTagStatsExpanded(expanded) {
  try {
    localStorage.setItem(TAG_STATS_EXPANDED_KEY, expanded ? "true" : "false");
  } catch (_) {
    /* ignore */
  }
}

function syncHelloTagStatsCollapse() {
  const block = els.helloTagStatsBlock;
  const btn = els.helloTagStatsToggle;
  if (!block || !btn) return;
  const expanded = readTagStatsExpanded();
  block.classList.toggle("is-collapsed", !expanded);
  btn.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function ensureHelloTagStatsToggle() {
  const btn = els.helloTagStatsToggle;
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    writeTagStatsExpanded(!readTagStatsExpanded());
    syncHelloTagStatsCollapse();
  });
}

export function renderHello() {
  const tags = state.data.tags || [];
  const points = state.data.motivation.tagPoints || {};
  const xp = state.data.motivation.totalXp || 0;
  const info = xpToNextLevel(xp);
  const levelStart = triangular(info.level);
  const levelSpan = Math.max(1, info.nextReq - levelStart);
  const inLevel = Math.max(0, info.current - levelStart);
  const pct = Math.min(100, Math.max(0, Math.round((inLevel / levelSpan) * 100)));
  const toNext = Math.max(0, info.nextReq - info.current);
  const pctUnit = pct / 100;

  els.helloLevelLabel.textContent = String(info.level);
  els.helloXpLabel.textContent = `${info.current} / ${info.nextReq} XP`;
  if (els.helloXpHint) {
    if (!tags.length) {
      els.helloXpHint.textContent = "Добавьте теги в настройках — тогда задачи будут давать XP.";
    } else if (toNext === 0) {
      els.helloXpHint.textContent = "Уровень повышен! Продолжайте в том же духе.";
    } else {
      els.helloXpHint.textContent = `До уровня ${info.level + 1}: ещё ${toNext} XP`;
    }
  }
  if (els.helloLevelRing) els.helloLevelRing.style.setProperty("--motivation-pct", String(pctUnit));
  if (els.helloXpBarFill) els.helloXpBarFill.style.width = `${pct}%`;
  if (els.helloXpTrack) els.helloXpTrack.setAttribute("aria-valuenow", String(pct));

  els.helloTagStats.innerHTML = "";
  if (!tags.length) {
    els.helloTagStats.className = "motivation-tags motivation-tags--empty list-empty-hint";
    els.helloTagStats.textContent = "Тегов пока нет. Создай их в Setting → Теги.";
    drawRadar(els.helloRadarCanvas, [], []);
  } else {
    els.helloTagStats.className = "motivation-tags";
    const sorted = [...tags].sort(
      (a, b) => Math.trunc(points[b.id] || 0) - Math.trunc(points[a.id] || 0)
    );
    const maxPts = Math.max(1, ...sorted.map((t) => Math.trunc(points[t.id] || 0)));
    sorted.forEach((tag, i) => {
      const v = Math.trunc(points[tag.id] || 0);
      const chip = document.createElement("div");
      chip.className = "motivation-tag-chip";
      chip.title = `${tag.title}: ${v} очков по тегу`;
      const rank = document.createElement("span");
      rank.className = "motivation-tag-rank";
      rank.textContent = String(i + 1);
      const name = document.createElement("span");
      name.className = "motivation-tag-name";
      name.textContent = tag.title;
      const barWrap = document.createElement("span");
      barWrap.className = "motivation-tag-meter";
      const bar = document.createElement("span");
      bar.className = "motivation-tag-meter-fill";
      bar.style.width = `${Math.round((v / maxPts) * 100)}%`;
      barWrap.appendChild(bar);
      const val = document.createElement("span");
      val.className = "motivation-tag-val";
      val.textContent = String(v);
      chip.appendChild(rank);
      chip.appendChild(name);
      chip.appendChild(barWrap);
      chip.appendChild(val);
      els.helloTagStats.appendChild(chip);
    });
    const values = tags.map((t) => Math.trunc(points[t.id] || 0));
    drawRadar(els.helloRadarCanvas, tags, values);
  }

  ensureHelloTagStatsToggle();
  syncHelloTagStatsCollapse();

  if (els.helloDailyList) {
    const { list } = getTodayDailyItems();
    els.helloDailyList.innerHTML = "";
    if (!list.length) {
      els.helloDailyList.className = "list-empty-hint";
      els.helloDailyList.textContent = "Нет шаблонов — вкладка Daily.";
    } else {
      els.helloDailyList.className = "task-list";
      list.forEach((item) => {
        els.helloDailyList.appendChild(createDailyTodayRow(item));
      });
    }
  }

  const tasks = state.data.tasks;
  const active = tasks.filter((t) => t.status === "next" && !t.projectId);
  els.activeTaskCount.textContent = String(active.length);

  els.helloActiveList.innerHTML = "";
  if (!active.length) {
    els.helloActiveList.className = "list-empty-hint";
    els.helloActiveList.textContent = "Нет активных задач.";
  } else {
    els.helloActiveList.className = "task-list";
    active.slice(0, 20).forEach((t) => els.helloActiveList.appendChild(makeTaskRow(t, { compact: true })));
  }

  const projectTasks = tasks.filter((t) => t.status === "next" && t.projectId);
  els.helloProjectPeekList.innerHTML = "";
  if (!projectTasks.length) {
    els.helloProjectPeekList.className = "list-empty-hint";
    els.helloProjectPeekList.textContent = "Нет задач из проектов.";
  } else {
    els.helloProjectPeekList.className = "task-list";
    const byProject = new Map();
    projectTasks.forEach((t) => {
      const arr = byProject.get(t.projectId) || [];
      arr.push(t);
      byProject.set(t.projectId, arr);
    });
    const topProjects = [...byProject.entries()].slice(0, 2);
    topProjects.forEach(([projectId, plist]) => {
      const project = state.data.projects.find((p) => p.id === projectId);
      const header = document.createElement("div");
      header.className = "task-item task-item--readonly";
      const body = document.createElement("div");
      body.className = "task-body";
      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = project ? `проект ${project.title}:` : "проект:";
      body.appendChild(title);
      header.appendChild(body);
      els.helloProjectPeekList.appendChild(header);
      plist.slice(0, 2).forEach((t) => els.helloProjectPeekList.appendChild(makeTaskRow(t, { compact: true })));
    });
  }
}
