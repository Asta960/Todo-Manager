import { state } from "../state.js";
import { nowIso } from "../utils/time.js";
import { cryptoRandomId } from "../utils/id.js";
import { addXp } from "../motivation/xp.js";
import { pushEvent } from "../data/events.js";
import { persist } from "../data/persist.js";
import { renderAll } from "../renderLoop.js";

function tagIdForTaskDoneXp(task) {
  if (task.projectId) {
    const project = state.data.projects.find((p) => p.id === task.projectId);
    if (project?.tagId) return project.tagId;
  }
  return task.tagId || null;
}

export function makeTaskRow(task, { compact = false } = {}) {
  const row = document.createElement("div");
  row.className = `task-item ${task.status === "done" ? "done" : ""}`;

  const body = document.createElement("div");
  body.className = "task-body";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "task-actions";

  if (!compact) {
    const metaText = document.createElement("span");
    metaText.className = "badge";
    const tag = state.data.tags?.find((t) => t.id === task.tagId);
    metaText.textContent = tag ? `#${tag.title}` : "—";
    meta.appendChild(metaText);
  }

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "btn btn-accent";
  doneBtn.textContent = "Готово";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "btn btn-delete";
  delBtn.textContent = "Удалить";

  doneBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (task.status === "done") return;
    const doneAt = nowIso();
    task.status = "done";
    task.updatedAt = doneAt;
    task.doneAt = doneAt;
    const xpTagId = tagIdForTaskDoneXp(task);
    addXp(xpTagId, 1, "task_done", task.id);
    pushEvent("task_done", { taskId: task.id, tagId: xpTagId, projectId: task.projectId || null, doneAt });
    if (!task.projectId) {
      state.data.tasks = state.data.tasks.filter((t) => t.id !== task.id);
    }
    await persist();
    renderAll();
  });

  delBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    state.data.tasks = state.data.tasks.filter((t) => t.id !== task.id);
    pushEvent("task_deleted", { taskId: task.id });
    await persist();
    renderAll();
  });

  meta.appendChild(doneBtn);
  meta.appendChild(delBtn);

  row.appendChild(body);
  row.appendChild(meta);

  return row;
}

export function makeInboxRow(item) {
  const row = document.createElement("div");
  row.className = "task-item task-item--draggable";
  row.draggable = true;
  row.dataset.inboxId = item.id;

  row.addEventListener("dragstart", (e) => {
    if (e.target.closest("button")) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("task-item--dragging");
    document.body.classList.add("inbox-dnd-active");
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("task-item--dragging");
    document.body.classList.remove("inbox-dnd-active");
  });

  const body = document.createElement("div");
  body.className = "task-body";
  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = item.title;
  body.appendChild(title);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const toTaskBtn = document.createElement("button");
  toTaskBtn.type = "button";
  toTaskBtn.className = "btn btn-accent";
  toTaskBtn.textContent = "В Task";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "btn btn-delete";
  delBtn.textContent = "Удалить";

  toTaskBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const task = {
      id: cryptoRandomId(),
      title: item.title,
      note: item.note || "",
      status: "next",
      createdAt: item.createdAt || nowIso(),
      updatedAt: nowIso(),
      projectId: null,
      tagId: item.tagId || null,
      groupId: item.groupId ?? null,
      doneAt: null
    };
    state.data.tasks.unshift(task);
    state.data.inbox = state.data.inbox.filter((x) => x.id !== item.id);
    pushEvent("inbox_to_task", { inboxId: item.id, taskId: task.id });
    await persist();
    renderAll();
  });

  delBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    state.data.inbox = state.data.inbox.filter((x) => x.id !== item.id);
    pushEvent("inbox_deleted", { inboxId: item.id });
    await persist();
    renderAll();
  });

  actions.appendChild(toTaskBtn);
  actions.appendChild(delBtn);

  row.appendChild(body);
  row.appendChild(actions);
  return row;
}
