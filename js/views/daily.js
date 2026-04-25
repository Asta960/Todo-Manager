import { state } from "../state.js";
import { els } from "../dom.js";
import { enhanceSelect } from "../ui/dropdown.js";
import { pushEvent } from "../data/events.js";
import { persist } from "../data/persist.js";
import { renderAll } from "../renderLoop.js";

export function renderDaily() {
  if (els.dailyTemplateTagSelect) {
    const tags = state.data.tags || [];
    const sig = tags.map((t) => t.id).join("|");
    if (els.dailyTemplateTagSelect.dataset.tagsSig !== sig) {
      const prev = els.dailyTemplateTagSelect.value;
      els.dailyTemplateTagSelect.innerHTML = "<option value=\"\">Тег</option>";
      tags.forEach((tag) => {
        const opt = document.createElement("option");
        opt.value = tag.id;
        opt.textContent = tag.title;
        els.dailyTemplateTagSelect.appendChild(opt);
      });
      els.dailyTemplateTagSelect.value = prev && tags.some((t) => t.id === prev) ? prev : "";
      enhanceSelect(els.dailyTemplateTagSelect);
      els.dailyTemplateTagSelect.dataset.tagsSig = sig;
    }
  }

  els.dailyTemplatesList.innerHTML = "";
  if (!state.data.dailyTemplates.length) {
    els.dailyTemplatesList.className = "list-empty-hint";
    els.dailyTemplatesList.textContent = "Шаблонов пока нет.";
  } else {
    els.dailyTemplatesList.className = "task-list";
    state.data.dailyTemplates.forEach((t) => {
      const row = document.createElement("div");
      row.className = "task-item";
      const body = document.createElement("div");
      body.className = "task-body";
      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = t.title;
      body.appendChild(title);
      const actions = document.createElement("div");
      actions.className = "task-actions";

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-delete";
      del.textContent = "Удалить";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        state.data.dailyTemplates = state.data.dailyTemplates.filter((x) => x.id !== t.id);
        Object.values(state.data.dailyStateByDate).forEach((arr) => {
          if (Array.isArray(arr)) {
            for (let i = arr.length - 1; i >= 0; i -= 1) {
              if (arr[i]?.templateId === t.id) arr.splice(i, 1);
            }
          }
        });
        pushEvent("daily_template_deleted", { templateId: t.id });
        await persist();
        renderAll();
      });
      actions.appendChild(del);
      row.appendChild(body);
      row.appendChild(actions);
      els.dailyTemplatesList.appendChild(row);
    });
  }
}
