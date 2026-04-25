import { state } from "../state.js";
import { els } from "../dom.js";
import { setAccent } from "../utils/color.js";
import { pushEvent } from "../data/events.js";
import { persist } from "../data/persist.js";
import { renderAll } from "../renderLoop.js";
import { renderHello } from "./hello.js";

export function renderSettingsPanel() {
  if (!state.data) return;
  els.savePathLabel.textContent = state.dataFilePath || "не выбран";
  els.accentColorInput.value = state.data.settings.accent || "#E3B57D";
  setAccent(els.accentColorInput.value);
  if (state.currentView === "hello") renderHello();

  if (els.tagsList) {
    els.tagsList.innerHTML = "";
    const tags = state.data.tags || [];
    if (!tags.length) {
      els.tagsList.className = "list-empty-hint";
      els.tagsList.textContent = "Тегов пока нет.";
    } else {
      els.tagsList.className = "task-list";
      tags.forEach((tag) => {
        const row = document.createElement("div");
        row.className = "task-item";
        const body = document.createElement("div");
        body.className = "task-body";
        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = tag.title;
        body.appendChild(title);

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-delete";
        del.textContent = "Удалить";
        del.addEventListener("click", async () => {
          state.data.tags = state.data.tags.filter((t) => t.id !== tag.id);
          state.data.tasks.forEach((t) => {
            if (t.tagId === tag.id) t.tagId = null;
          });
          state.data.projects.forEach((p) => {
            if (p.tagId === tag.id) p.tagId = null;
          });
          state.data.dailyTemplates.forEach((t) => {
            if (t.tagId === tag.id) t.tagId = null;
          });
          if (state.data.motivation?.tagPoints) delete state.data.motivation.tagPoints[tag.id];
          pushEvent("tag_deleted", { tagId: tag.id });
          await persist();
          renderAll();
        });

        actions.appendChild(del);
        row.appendChild(body);
        row.appendChild(actions);
        els.tagsList.appendChild(row);
      });
    }
  }
}
