import { state } from "../state.js";
import { els } from "../dom.js";
import { enhanceSelect } from "../ui/dropdown.js";

export function renderDev() {
  if (!els.devTagSelect) return;
  const tags = state.data.tags || [];
  const sig = tags.map((t) => t.id).join("|");
  if (els.devTagSelect.dataset.tagsSig !== sig) {
    const prev = els.devTagSelect.value;
    els.devTagSelect.innerHTML = "<option value=\"\">Тег</option>";
    tags.forEach((tag) => {
      const opt = document.createElement("option");
      opt.value = tag.id;
      opt.textContent = tag.title;
      els.devTagSelect.appendChild(opt);
    });
    els.devTagSelect.value = prev && tags.some((t) => t.id === prev) ? prev : "";
    enhanceSelect(els.devTagSelect);
    els.devTagSelect.dataset.tagsSig = sig;
  }
}

