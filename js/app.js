import { state } from "./state.js";
import { els } from "./dom.js";
import { VIEW_TITLES } from "./constants.js";
import { setRenderAll, renderAll } from "./renderLoop.js";
import { ensureDataShapeV3 } from "./data/schema.js";
import { persist } from "./data/persist.js";
import { pushEvent } from "./data/events.js";
import { setAccent } from "./utils/color.js";
import { cryptoRandomId } from "./utils/id.js";
import { todayKey } from "./utils/time.js";
import { addXp, xpToNextLevel } from "./motivation/xp.js";
import { renderHello } from "./views/hello.js";
import { renderInbox } from "./views/inbox.js";
import { renderTasks } from "./views/tasks.js";
import { renderProjects } from "./views/projects.js";
import { renderDaily } from "./views/daily.js";
import { getTodayDailyItems, toggleDailyDone } from "./daily/helpers.js";
import { renderDev } from "./views/dev.js";
import { renderSettingsPanel } from "./views/settings.js";
import { initXpToasts } from "./ui/xpToast.js";
import { initLevelUpOverlay } from "./ui/levelUpOverlay.js";

const DEV_NAV_LS_KEY = "devNavUnlocked";

function readDevNavUnlocked() {
  try {
    return localStorage.getItem(DEV_NAV_LS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDevNavUnlocked(on) {
  try {
    if (on) localStorage.setItem(DEV_NAV_LS_KEY, "1");
    else localStorage.removeItem(DEV_NAV_LS_KEY);
  } catch {
    /* ignore */
  }
}

function applyDevNavVisibility(unlocked) {
  if (!els.devNavBtn) return;
  els.devNavBtn.classList.toggle("nav-item--dev-visible", !!unlocked);
}

function syncDevNavFromStorage() {
  applyDevNavVisibility(readDevNavUnlocked());
}

function makeEmptyDataFromCurrent() {
  const accent = state.data?.settings?.accent || "#E3B57D";
  const autosave = state.data?.settings?.autosave ?? true;
  return ensureDataShapeV3({
    meta: { createdAt: new Date().toISOString() },
    settings: { autosave, accent },
    inbox: [],
    taskGroups: [],
    tasks: [],
    projects: [],
    tags: [],
    motivation: { tagPoints: {}, totalXp: 0 },
    dailyTemplates: [],
    dailyStateByDate: {}
  });
}

function syncSidebarUi() {
  if (!els.appShell || !els.sidebarToggle) return;
  els.appShell.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  els.sidebarToggle.setAttribute("aria-expanded", state.sidebarCollapsed ? "false" : "true");
  els.sidebarToggle.textContent = state.sidebarCollapsed ? "›" : "‹";
  if (els.sidebarBackdrop) {
    const mobile = window.innerWidth < 920;
    els.sidebarBackdrop.setAttribute("aria-hidden", !mobile || state.sidebarCollapsed ? "true" : "false");
  }
}

function switchView(view) {
  state.currentView = view;
  if (view === "projects") {
    state.projectsMode = "list";
  }
  els.pageTitle.textContent = VIEW_TITLES[view] || "TODO Manager";
  Object.entries(els.views).forEach(([key, el]) => el.classList.toggle("active", key === view));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  if (els.contentScroll) els.contentScroll.scrollTop = 0;
  renderAll();
}

function runRenderAll() {
  if (!state.data) return;
  renderSettingsPanel();
  if (state.currentView === "hello") renderHello();
  if (state.currentView === "inbox") renderInbox();
  if (state.currentView === "tasks") renderTasks();
  if (state.currentView === "projects") renderProjects();
  if (state.currentView === "daily") renderDaily();
  if (state.currentView === "dev") renderDev();
}

async function addInboxItemFromInput(inputEl) {
  const title = (inputEl.value || "").trim();
  if (!title) return;
  const tagId = els.inboxTagSelect ? els.inboxTagSelect.value || null : null;
  const rawGroup = els.inboxGroupSelect?.value?.trim() || null;
  const groups = state.data.taskGroups || [];
  const groupId = rawGroup && groups.some((g) => g.id === rawGroup) ? rawGroup : null;
  const item = { id: cryptoRandomId(), title, note: "", createdAt: new Date().toISOString(), tagId, groupId };
  state.data.inbox.unshift(item);
  inputEl.value = "";
  pushEvent("inbox_created", { inboxId: item.id });
  await persist();
  renderAll();
}

async function createProject() {
  const title = (els.projectTitleInput?.value || "").trim();
  if (!title) return;
  const rawTag = (els.projectTagSelect?.value || "").trim();
  const tagId =
    rawTag && state.data.tags.some((t) => t.id === rawTag) ? rawTag : null;
  const proj = {
    id: cryptoRandomId(),
    title,
    description: "",
    tagId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.data.projects.unshift(proj);
  state.activeProjectId = proj.id;
  pushEvent("project_created", { projectId: proj.id });
  if (els.projectTitleInput) els.projectTitleInput.value = "";
  await persist();
  renderAll();
}

async function addDailyTemplate() {
  const title = (els.dailyTemplateInput.value || "").trim();
  if (!title) return;
  const rawTag = (els.dailyTemplateTagSelect?.value || "").trim();
  const tagId =
    rawTag && state.data.tags.some((x) => x.id === rawTag) ? rawTag : null;
  const t = { id: cryptoRandomId(), title, note: "", tagId };
  state.data.dailyTemplates.push(t);

  const today = todayKey();
  if (!state.data.dailyStateByDate[today]) state.data.dailyStateByDate[today] = [];
  state.data.dailyStateByDate[today].push({ templateId: t.id, titleSnapshot: t.title, done: false });

  els.dailyTemplateInput.value = "";
  pushEvent("daily_template_created", { templateId: t.id });
  await persist();
  renderAll();
}

function bindEvents() {
  els.navItems.forEach((item) =>
    item.addEventListener("click", () => {
      switchView(item.dataset.view);
      if (window.innerWidth < 920) {
        state.sidebarCollapsed = true;
        syncSidebarUi();
      }
    })
  );

  if (els.sidebarToggle && els.appShell) {
    els.sidebarToggle.addEventListener("click", () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      syncSidebarUi();
    });
  }

  if (els.sidebarBackdrop) {
    els.sidebarBackdrop.addEventListener("click", () => {
      if (window.innerWidth < 920 && !state.sidebarCollapsed) {
        state.sidebarCollapsed = true;
        syncSidebarUi();
      }
    });
  }

  if (els.inboxAddBtn && els.inboxInput) {
    els.inboxAddBtn.addEventListener("click", () => addInboxItemFromInput(els.inboxInput));
    els.inboxInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addInboxItemFromInput(els.inboxInput);
    });
  }

  async function createInboxGroup() {
    if (!state.data || !els.inboxGroupTitleInput) return;
    const title = (els.inboxGroupTitleInput.value || "").trim() || "Группа";
    const order =
      state.data.taskGroups.length > 0 ? Math.max(...state.data.taskGroups.map((g) => g.order)) + 1 : 0;
    state.data.taskGroups.push({ id: cryptoRandomId(), title, order });
    els.inboxGroupTitleInput.value = "";
    pushEvent("task_group_created", { title });
    await persist();
    renderAll();
  }

  if (els.inboxCreateGroupBtn && els.inboxGroupTitleInput) {
    els.inboxCreateGroupBtn.addEventListener("click", () => createInboxGroup());
    els.inboxGroupTitleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createInboxGroup();
    });
  }

  if (els.createProjectBtn) els.createProjectBtn.addEventListener("click", createProject);
  if (els.projectTitleInput) {
    els.projectTitleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createProject();
    });
  }
  if (els.projectBackBtn) {
    els.projectBackBtn.addEventListener("click", () => {
      state.projectsMode = "list";
      renderAll();
    });
  }

  if (els.dailyTemplateAddBtn) els.dailyTemplateAddBtn.addEventListener("click", addDailyTemplate);
  if (els.dailyTemplateInput) {
    els.dailyTemplateInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addDailyTemplate();
    });
  }

  if (els.accentColorInput) {
    els.accentColorInput.addEventListener("input", async (e) => {
      state.data.settings.accent = e.target.value;
      setAccent(e.target.value);
      await persist();
    });
  }

  if (els.changePathBtn) {
    els.changePathBtn.addEventListener("click", async () => {
      const result = await window.electronAPI.changeSaveLocation(state.data);
      if (!result || result.canceled) return;
      state.dataFilePath = result.dataFilePath;
      renderSettingsPanel();
    });
  }

  if (els.importBtn) {
    els.importBtn.addEventListener("click", async () => {
      const result = await window.electronAPI.importData();
      if (!result || result.canceled) return;
      state.data = ensureDataShapeV3(result.data);
      pushEvent("data_imported", { importPath: result.importPath });
      await persist();
      renderAll();
    });
  }

  if (els.exportBtn) els.exportBtn.addEventListener("click", async () => window.electronAPI.exportData(state.data));

  if (els.resetAllDataBtn) {
    els.resetAllDataBtn.addEventListener("click", async () => {
      const ok = confirm("Обнулить все данные? Это удалит задачи, проекты, теги, XP и историю. Действие нельзя отменить.");
      if (!ok) return;
      state.data = makeEmptyDataFromCurrent();
      state.activeProjectId = null;
      state.projectsMode = "list";
      state.currentView = "hello";
      await persist();
      renderAll();
    });
  }

  if (els.tagAddBtn && els.tagInput) {
    const addTag = async () => {
      const title = (els.tagInput.value || "").trim();
      if (!title) return;
      const tag = { id: cryptoRandomId(), title, createdAt: new Date().toISOString() };
      state.data.tags.unshift(tag);
      if (!state.data.motivation.tagPoints[tag.id]) state.data.motivation.tagPoints[tag.id] = 0;
      els.tagInput.value = "";
      pushEvent("tag_created", { tagId: tag.id });
      await persist();
      renderAll();
    };
    els.tagAddBtn.addEventListener("click", addTag);
    els.tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTag();
    });
  }

  if (els.winMinBtn && els.winMaxBtn && els.winCloseBtn) {
    els.winMinBtn.addEventListener("click", () => window.electronAPI.minimize());
    els.winMaxBtn.addEventListener("click", () => window.electronAPI.maximizeToggle());
    els.winCloseBtn.addEventListener("click", () => window.electronAPI.closeWindow());
  }

  if (els.radarZoomOutBtn && els.radarZoomInBtn && els.helloRadarCanvas) {
    const applyZoom = async (delta) => {
      state.radarZoom = Math.max(0.6, Math.min(1.8, (state.radarZoom || 1) + delta));
      renderHello();
      await persist();
    };
    els.radarZoomOutBtn.addEventListener("click", () => applyZoom(-0.1));
    els.radarZoomInBtn.addEventListener("click", () => applyZoom(0.1));
    els.helloRadarCanvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const dir = e.deltaY > 0 ? -1 : 1;
        state.radarZoom = Math.max(0.6, Math.min(1.8, (state.radarZoom || 1) + dir * 0.08));
        renderHello();
      },
      { passive: false }
    );
  }

  if (els.devAddXpBtn || els.devLevelUpBtn || els.devCompleteDailyBtn) {
    const getDevTagId = () => {
      const raw = (els.devTagSelect?.value || "").trim();
      return raw && state.data.tags.some((t) => t.id === raw) ? raw : null;
    };

    if (els.devAddXpBtn) {
      els.devAddXpBtn.addEventListener("click", async () => {
        const tagId = getDevTagId();
        if (!tagId) return;
        addXp(tagId, 1, "dev_xp", "manual");
        await persist();
        renderAll();
      });
    }

    if (els.devLevelUpBtn) {
      els.devLevelUpBtn.addEventListener("click", async () => {
        const tagId = getDevTagId();
        if (!tagId) return;
        const xp = Math.max(0, Math.trunc(state.data.motivation.totalXp || 0));
        const info = xpToNextLevel(xp);
        const delta = Math.max(0, info.nextReq - info.current);
        if (!delta) return;
        addXp(tagId, delta, "dev_level_up", "manual");
        await persist();
        renderAll();
      });
    }

    if (els.devCompleteDailyBtn) {
      els.devCompleteDailyBtn.addEventListener("click", async () => {
        const { list } = getTodayDailyItems();
        for (const item of list) {
          if (!item?.templateId) continue;
          if (!item.done) await toggleDailyDone(item.templateId);
        }
      });
    }
  }

  let settingsTitleClicks = 0;
  let settingsTitleClickTimer = null;
  if (els.pageTitle && els.devNavBtn) {
    els.pageTitle.addEventListener("click", () => {
      if (state.currentView !== "settings") return;
      settingsTitleClicks += 1;
      if (settingsTitleClickTimer) window.clearTimeout(settingsTitleClickTimer);
      if (settingsTitleClicks >= 3) {
        settingsTitleClicks = 0;
        const next = !readDevNavUnlocked();
        writeDevNavUnlocked(next);
        applyDevNavVisibility(next);
        if (!next && state.currentView === "dev") {
          switchView("settings");
        }
        return;
      }
      settingsTitleClickTimer = window.setTimeout(() => {
        settingsTitleClicks = 0;
      }, 600);
    });
  }
}

async function init() {
  setRenderAll(runRenderAll);
  const { data, dataFilePath } = await window.electronAPI.initData();
  state.data = ensureDataShapeV3(data);
  state.dataFilePath = dataFilePath;
  bindEvents();
  syncDevNavFromStorage();
  initXpToasts();
  initLevelUpOverlay();
  syncSidebarUi();
  switchView("hello");

  window.addEventListener("resize", () => {
    if (state.currentView === "hello") renderHello();
  });
}

init().catch((error) => {
  console.error(error);
  alert(`Ошибка инициализации: ${error.message}`);
});
