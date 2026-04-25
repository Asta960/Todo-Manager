const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require("electron");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

const WINDOW_DEFAULT_WIDTH = 900;
const WINDOW_DEFAULT_HEIGHT = 650;
const WINDOW_MIN_WIDTH = 380;
const WINDOW_MIN_HEIGHT = 420;
const CONFIG_FILE = "app-config.json";
const DATA_FILE_NAME = "eternal-todo-data.json";
const SCHEMA_VERSION = 3;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;
let windowStateSaveTimer = null;

function clampInt(v, min, max) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function cryptoRandomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function toDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function defaultDailyTemplates() {
  return [];
}

function createDefaultData() {
  const dailyTemplates = defaultDailyTemplates();
  const today = toDateKey();
  return {
    meta: {
      createdAt: nowIso(),
      lastActiveDate: today,
      schemaVersion: SCHEMA_VERSION
    },
    settings: {
      autosave: true,
      accent: "#E3B57D"
    },
    inbox: [],
    taskGroups: [],
    tasks: [],
    projects: [],
    tags: [],
    motivation: {
      tagPoints: {},
      totalXp: 0
    },
    dailyTemplates,
    dailyStateByDate: {
      [today]: dailyTemplates.map((t) => ({
        templateId: t.id,
        titleSnapshot: t.title,
        done: false
      }))
    }
  };
}

function ensureV3Shape(data) {
  const safe = data && typeof data === "object" ? data : {};
  safe.meta = safe.meta || { createdAt: nowIso(), lastActiveDate: toDateKey(), schemaVersion: SCHEMA_VERSION };
  safe.meta.createdAt = safe.meta.createdAt || nowIso();
  safe.meta.lastActiveDate = safe.meta.lastActiveDate || toDateKey();
  safe.meta.schemaVersion = SCHEMA_VERSION;
  safe.settings = safe.settings || { autosave: true, accent: "#E3B57D" };
  if (typeof safe.settings.autosave !== "boolean") safe.settings.autosave = true;
  if (!safe.settings.accent) safe.settings.accent = "#E3B57D";

  safe.inbox = Array.isArray(safe.inbox) ? safe.inbox : [];
  safe.taskGroups = Array.isArray(safe.taskGroups) ? safe.taskGroups : [];
  safe.tasks = Array.isArray(safe.tasks) ? safe.tasks : [];
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
  safe.dailyTemplates = Array.isArray(safe.dailyTemplates) ? safe.dailyTemplates : defaultDailyTemplates();
  safe.dailyTemplates.forEach((t) => {
    if (t && typeof t === "object") {
      const tid = t.tagId;
      t.tagId = tid && typeof tid === "string" && tagIdSet.has(tid) ? tid : null;
    }
  });
  safe.dailyStateByDate = safe.dailyStateByDate && typeof safe.dailyStateByDate === "object" ? safe.dailyStateByDate : {};
  delete safe.events;
  return safe;
}

function migrateLegacyData(rawData) {
  const data = rawData && typeof rawData === "object" ? rawData : {};

  // Already v3-ish (or future): normalize shape and return.
  if (data?.meta?.schemaVersion >= SCHEMA_VERSION || Array.isArray(data.inbox) || Array.isArray(data.tasks) || Array.isArray(data.projects)) {
    return ensureV3Shape(data);
  }

  const migrated = createDefaultData();
  migrated.settings.autosave = data.settings?.autosave ?? true;
  migrated.settings.accent = data.settings?.accent || migrated.settings.accent;
  migrated.meta.createdAt = data.meta?.createdAt || migrated.meta.createdAt;

  // v2 structure (dailyTemplates/dailyState/oneoffTasks/historyByDate)
  if (Array.isArray(data.dailyTemplates) && Array.isArray(data.dailyState) && Array.isArray(data.oneoffTasks)) {
    migrated.dailyTemplates = data.dailyTemplates.map((t) => ({ id: String(t.id || cryptoRandomId()), title: String(t.title || "Задача") }));

    const today = toDateKey();
    migrated.dailyStateByDate[today] = data.dailyState.map((t) => ({
      templateId: String(t.id || cryptoRandomId()),
      titleSnapshot: String(t.title || "Задача"),
      done: !!t.done,
      doneAt: t.done ? nowIso() : undefined
    }));

    migrated.tasks = data.oneoffTasks.map((t) => ({
      id: String(t.id || cryptoRandomId()),
      title: String(t.title || "Задача"),
      note: "",
      status: t.done ? "done" : "next",
      createdAt: migrated.meta.createdAt,
      updatedAt: nowIso(),
      projectId: null,
      deadlineAt: null,
      remindAt: null,
      scheduledAt: null,
      doneAt: t.done ? nowIso() : null
    }));

    // Migrate historyByDate → dailyStateByDate (best effort)
    if (data.historyByDate && typeof data.historyByDate === "object") {
      Object.entries(data.historyByDate).forEach(([dateKey, snap]) => {
        if (migrated.dailyStateByDate[dateKey]) return;
        const daily = Array.isArray(snap?.daily) ? snap.daily : [];
        migrated.dailyStateByDate[dateKey] = daily.map((t) => ({
          templateId: String(t.id || cryptoRandomId()),
          titleSnapshot: String(t.title || "Задача"),
          done: !!t.done,
          doneAt: t.done ? `${dateKey}T23:59:59` : undefined
        }));
      });
    }

    migrated.meta.lastActiveDate = data.meta?.lastActiveDate || migrated.meta.lastActiveDate;
    return ensureV3Shape(migrated);
  }

  // Very old structure (templates/todayTasks)
  const templates = Array.isArray(data.templates) && data.templates.length
    ? data.templates.map((task) => ({ id: cryptoRandomId(), title: String(task.title || "Задача") }))
    : migrated.dailyTemplates;

  migrated.dailyTemplates = templates;
  const today = toDateKey();
  const todayTasks = Array.isArray(data.todayTasks) ? data.todayTasks : [];
  const byTitleDone = new Map(todayTasks.map((task) => [String(task.title || ""), !!task.done]));
  migrated.dailyStateByDate[today] = templates.map((t) => ({
    templateId: t.id,
    titleSnapshot: t.title,
    done: byTitleDone.get(t.title) || false,
    doneAt: byTitleDone.get(t.title) ? nowIso() : undefined
  }));

  return ensureV3Shape(migrated);
}

function applyDailyResetIfNeeded(data) {
  const safe = ensureV3Shape(data);
  const today = toDateKey();
  const lastDate = safe.meta?.lastActiveDate;
  if (!lastDate || lastDate === today) return false;

  // Ensure we have a per-date state for lastDate (it might already exist from migration).
  if (!safe.dailyStateByDate[lastDate]) {
    safe.dailyStateByDate[lastDate] = safe.dailyTemplates.map((t) => ({
      templateId: t.id,
      titleSnapshot: t.title,
      done: false
    }));
  }

  // Create today's daily state from templates if missing.
  if (!safe.dailyStateByDate[today]) {
    safe.dailyStateByDate[today] = safe.dailyTemplates.map((t) => ({
      templateId: t.id,
      titleSnapshot: t.title,
      done: false
    }));
  }

  safe.meta.lastActiveDate = today;
  return true;
}

function getConfigPath() {
  return path.join(app.getPath("userData"), CONFIG_FILE);
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(getConfigPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveConfig(config) {
  await fs.writeFile(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

async function updateConfig(patch) {
  const prev = await loadConfig();
  const next = { ...(prev && typeof prev === "object" ? prev : {}), ...(patch && typeof patch === "object" ? patch : {}) };
  await saveConfig(next);
  return next;
}

function getWindowStateToPersist(win) {
  if (!win) return null;
  const isMaximized = win.isMaximized();
  const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
  return {
    isMaximized,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

function scheduleWindowStateSave() {
  if (!mainWindow) return;
  if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(async () => {
    windowStateSaveTimer = null;
    const state = getWindowStateToPersist(mainWindow);
    if (!state) return;
    await updateConfig({ windowState: state });
  }, 350);
}

async function pickDataFile(defaultPath) {
  const result = await dialog.showSaveDialog({
    title: "Выберите место для файла данных",
    defaultPath,
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"]
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

async function ensureDataFilePath() {
  const config = await loadConfig();
  if (config.dataFilePath) {
    const configuredPath = config.dataFilePath;
    try {
      const dir = path.dirname(configuredPath);
      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
      return configuredPath;
    } catch {
      // Fall through to repick file path.
    }
  }

  const defaultPath = path.join(app.getPath("documents"), DATA_FILE_NAME);
  const chosenPath = await pickDataFile(defaultPath);
  if (!chosenPath) {
    throw new Error("Не выбран путь для файла данных.");
  }

  const data = createDefaultData();
  const dir = path.dirname(chosenPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(chosenPath, JSON.stringify(data, null, 2), "utf-8");
  await updateConfig({ dataFilePath: chosenPath });
  return chosenPath;
}

function createSplashWindow() {
  if (splashWindow) return splashWindow;
  splashWindow = new BrowserWindow({
    width: 320,
    height: 220,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    closable: false,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.once("ready-to-show", () => splashWindow?.show());
  return splashWindow;
}

function closeSplashWindow() {
  if (!splashWindow) return;
  try {
    splashWindow.destroy();
  } catch {
    /* ignore */
  }
  splashWindow = null;
}

async function readDataFile() {
  const dataFilePath = await ensureDataFilePath();
  try {
    const raw = await fs.readFile(dataFilePath, "utf-8");
    const migrated = migrateLegacyData(JSON.parse(raw));
    const changed = applyDailyResetIfNeeded(migrated);
    if (changed) {
      await fs.writeFile(dataFilePath, JSON.stringify(migrated, null, 2), "utf-8");
    }
    return { data: migrated, dataFilePath };
  } catch {
    const fallback = createDefaultData();
    await fs.writeFile(dataFilePath, JSON.stringify(fallback, null, 2), "utf-8");
    return { data: fallback, dataFilePath };
  }
}

async function saveDataFile(data, targetPath) {
  await fs.writeFile(targetPath, JSON.stringify(data, null, 2), "utf-8");
}

function createTrayImage() {
  const iconPath = path.join(__dirname, "image.png");
  if (fsSync.existsSync(iconPath)) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      const traySize = process.platform === "win32" ? 16 : 18;
      return image.resize({ width: traySize, height: traySize });
    }
  }
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  );
}

async function createMainWindow() {
  createSplashWindow();
  const config = await loadConfig();
  const ws = config && typeof config === "object" ? config.windowState : null;

  const restoredX = clampInt(ws?.x, -5000, 5000);
  const restoredY = clampInt(ws?.y, -5000, 5000);
  const restoredW = clampInt(ws?.width, WINDOW_MIN_WIDTH, 5000);
  const restoredH = clampInt(ws?.height, WINDOW_MIN_HEIGHT, 5000);
  const hasRestoredBounds = restoredW != null && restoredH != null && restoredX != null && restoredY != null;

  mainWindow = new BrowserWindow({
    width: hasRestoredBounds ? restoredW : WINDOW_DEFAULT_WIDTH,
    height: hasRestoredBounds ? restoredH : WINDOW_DEFAULT_HEIGHT,
    ...(hasRestoredBounds ? { x: restoredX, y: restoredY } : {}),
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    resizable: true,
    frame: false,
    show: false,
    backgroundColor: "#0b0b0f",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => {
    if (ws?.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
    closeSplashWindow();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      scheduleWindowStateSave();
      mainWindow.hide();
    }
  });

  mainWindow.on("move", scheduleWindowStateSave);
  mainWindow.on("resize", scheduleWindowStateSave);
  mainWindow.on("maximize", scheduleWindowStateSave);
  mainWindow.on("unmaximize", scheduleWindowStateSave);
}

function createAppTray() {
  tray = new Tray(createTrayImage());
  tray.setToolTip("Todo Manager");
  const menu = Menu.buildFromTemplate([
    {
      label: "Открыть",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: "Выход",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  const showTrayMenu = () => {
    tray.popUpContextMenu(menu);
  };

  tray.on("click", showTrayMenu);
  tray.on("right-click", showTrayMenu);

  tray.on("double-click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function registerIpc() {
  ipcMain.handle("data:init", async () => {
    return readDataFile();
  });

  ipcMain.handle("data:save", async (_, data) => {
    const dataFilePath = await ensureDataFilePath();
    await saveDataFile(data, dataFilePath);
    return { success: true, dataFilePath };
  });

  ipcMain.handle("data:change-location", async (_, currentData) => {
    const defaultPath = path.join(app.getPath("documents"), DATA_FILE_NAME);
    const chosenPath = await pickDataFile(defaultPath);
    if (!chosenPath) return { canceled: true };
    await saveDataFile(currentData, chosenPath);
    await updateConfig({ dataFilePath: chosenPath });
    return { canceled: false, dataFilePath: chosenPath };
  });

  ipcMain.handle("data:export", async (_, currentData) => {
    const result = await dialog.showSaveDialog({
      title: "Экспорт данных",
      defaultPath: path.join(app.getPath("documents"), "eternal-todo-export.json"),
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await saveDataFile(currentData, result.filePath);
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("data:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "Импорт данных",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths?.length) return { canceled: true };
    const importPath = result.filePaths[0];
    const raw = await fs.readFile(importPath, "utf-8");
    const data = JSON.parse(raw);
    const currentPath = await ensureDataFilePath();
    await saveDataFile(data, currentPath);
    return { canceled: false, data, importPath };
  });

  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window:maximize-toggle", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });

  ipcMain.handle("window:close", () => {
    if (!mainWindow) return;
    // Respect tray behavior unless user explicitly closes from titlebar.
    isQuitting = true;
    mainWindow.close();
  });
}

app.whenReady().then(() => {
  createMainWindow();
  createAppTray();
  registerIpc();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    mainWindow?.show();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

