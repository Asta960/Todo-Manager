import { state } from "../state.js";
import { els } from "../dom.js";
import { makeTaskRow } from "../components/taskRows.js";

export function renderTasks() {
  const list = state.data.tasks.filter((t) => !t.projectId);
  const groups = [...(state.data.taskGroups || [])].sort((a, b) => a.order - b.order);
  const orderedGroups = groups.filter((g) => list.some((t) => t.groupId === g.id));
  const knownGroupIds = new Set(groups.map((g) => g.id));
  const ungrouped = list.filter((t) => !t.groupId || !knownGroupIds.has(t.groupId));

  els.tasksList.innerHTML = "";
  if (!list.length) {
    els.tasksList.className = "list-empty-hint";
    els.tasksList.textContent = "Нет задач.";
    return;
  }

  const sortRu = (a, b) => String(a.title).localeCompare(String(b.title), "ru");

  if (!orderedGroups.length) {
    els.tasksList.className = "task-list";
    list.sort(sortRu).forEach((t) => els.tasksList.appendChild(makeTaskRow(t)));
    return;
  }

  els.tasksList.className = "task-list task-list--grouped";

  for (const g of orderedGroups) {
    const header = document.createElement("div");
    header.className = "task-group-heading";
    header.textContent = g.title;
    els.tasksList.appendChild(header);
    list
      .filter((t) => t.groupId === g.id)
      .sort(sortRu)
      .forEach((t) => els.tasksList.appendChild(makeTaskRow(t)));
  }

  if (ungrouped.length) {
    const header = document.createElement("div");
    header.className = "task-group-heading";
    header.textContent = "Без группы";
    els.tasksList.appendChild(header);
    ungrouped.sort(sortRu).forEach((t) => els.tasksList.appendChild(makeTaskRow(t)));
  }
}
