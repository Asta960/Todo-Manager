import { state } from "../state.js";
import { els } from "../dom.js";
import { enhanceSelect } from "../ui/dropdown.js";
import { makeInboxRow } from "../components/taskRows.js";
import { persist } from "../data/persist.js";
import { pushEvent } from "../data/events.js";
import { renderAll } from "../renderLoop.js";

function sameGroup(a, b) {
  const x = a ?? null;
  const y = b ?? null;
  return x === y;
}

function moveInboxItem(draggedId, targetGroupId, beforeId, placeEnd) {
  const inbox = state.data.inbox;
  const tg = targetGroupId ?? null;
  const gi = inbox.findIndex((x) => x.id === draggedId);
  if (gi === -1) return;
  const [it] = inbox.splice(gi, 1);
  it.groupId = tg;

  if (beforeId) {
    const j = inbox.findIndex((x) => x.id === beforeId);
    inbox.splice(j >= 0 ? j : inbox.length, 0, it);
  } else if (placeEnd) {
    let last = -1;
    for (let k = 0; k < inbox.length; k++) {
      if (sameGroup(inbox[k].groupId, tg)) last = k;
    }
    inbox.splice(last + 1, 0, it);
  } else {
    const first = inbox.findIndex((x) => sameGroup(x.groupId, tg));
    inbox.splice(first === -1 ? inbox.length : first, 0, it);
  }
}

function bindDropBody(body, groupId) {
  const gid = groupId ?? "";
  body.dataset.dropGroup = gid;

  body.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    body.classList.add("inbox-group__body--over");
  });
  body.addEventListener("dragleave", (e) => {
    if (!body.contains(e.relatedTarget)) body.classList.remove("inbox-group__body--over");
  });
  body.addEventListener("drop", async (e) => {
    e.preventDefault();
    body.classList.remove("inbox-group__body--over");
    const id = e.dataTransfer.getData("text/plain");
    if (!id || e.target.closest(".task-item")) return;
    const tg = gid === "" ? null : gid;
    moveInboxItem(id, tg, null, true);
    pushEvent("inbox_moved", { inboxId: id, groupId: tg });
    await persist();
    renderAll();
  });
}

function bindDropRow(row, itemId, groupId) {
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    row.classList.add("task-item--drop-before");
  });
  row.addEventListener("dragleave", (e) => {
    if (!row.contains(e.relatedTarget)) row.classList.remove("task-item--drop-before");
  });
  row.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    row.classList.remove("task-item--drop-before");
    const dragId = e.dataTransfer.getData("text/plain");
    if (!dragId || dragId === itemId) return;
    const tg = groupId ?? null;
    moveInboxItem(dragId, tg, itemId, false);
    pushEvent("inbox_moved", { inboxId: dragId, groupId: tg, beforeId: itemId });
    await persist();
    renderAll();
  });
}

async function deleteTaskGroup(groupId) {
  state.data.taskGroups = state.data.taskGroups.filter((g) => g.id !== groupId);
  state.data.taskGroups.forEach((g, i) => {
    g.order = i;
  });
  state.data.inbox.forEach((item) => {
    if (item.groupId === groupId) item.groupId = null;
  });
  state.data.tasks.forEach((t) => {
    if (t.groupId === groupId) t.groupId = null;
  });
  pushEvent("task_group_deleted", { groupId });
  await persist();
  renderAll();
}

export function renderInbox() {
  if (els.inboxTagSelect) {
    const tags = state.data.tags || [];
    const sig = tags.map((t) => t.id).join("|");
    if (els.inboxTagSelect.dataset.tagsSig !== sig) {
      const prev = els.inboxTagSelect.value;
      els.inboxTagSelect.innerHTML = "<option value=\"\">Тег</option>";
      tags.forEach((tag) => {
        const opt = document.createElement("option");
        opt.value = tag.id;
        opt.textContent = `${tag.title}`;
        els.inboxTagSelect.appendChild(opt);
      });
      els.inboxTagSelect.value = prev && tags.some((t) => t.id === prev) ? prev : "";
      enhanceSelect(els.inboxTagSelect);
      els.inboxTagSelect.dataset.tagsSig = sig;
    }
  }

  if (els.inboxGroupSelect) {
    const taskGroups = [...(state.data.taskGroups || [])].sort((a, b) => a.order - b.order);
    const sig = taskGroups.map((g) => `${g.id}:${g.title}`).join("|");
    if (els.inboxGroupSelect.dataset.groupsSig !== sig) {
      const prev = els.inboxGroupSelect.value;
      els.inboxGroupSelect.innerHTML = "<option value=\"\">Без группы</option>";
      taskGroups.forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.title;
        els.inboxGroupSelect.appendChild(opt);
      });
      els.inboxGroupSelect.value = prev && taskGroups.some((g) => g.id === prev) ? prev : "";
      enhanceSelect(els.inboxGroupSelect);
      els.inboxGroupSelect.dataset.groupsSig = sig;
    }
  }

  const inbox = state.data.inbox;
  const groups = [...(state.data.taskGroups || [])].sort((a, b) => a.order - b.order);

  els.inboxList.innerHTML = "";

  if (!inbox.length && !groups.length) {
    els.inboxList.className = "inbox-board list-empty-hint";
    els.inboxList.textContent = "Inbox пуст. Добавьте задачу или создайте группу.";
    return;
  }

  els.inboxList.className = "inbox-board";

  const renderItem = (item, groupId) => {
    const row = makeInboxRow(item);
    bindDropRow(row, item.id, groupId);
    return row;
  };

  for (const g of groups) {
    const section = document.createElement("div");
    section.className = "inbox-group";
    section.dataset.groupId = g.id;

    const head = document.createElement("div");
    head.className = "inbox-group__head task-group-heading";

    const title = document.createElement("span");
    title.className = "inbox-group__heading-label";
    title.textContent = g.title;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-delete inbox-group__delete";
    del.textContent = "Удалить группу";
    del.title = "Задачи останутся без группы";
    del.addEventListener("click", () => deleteTaskGroup(g.id));

    head.appendChild(title);
    head.appendChild(del);

    const body = document.createElement("div");
    body.className = "inbox-group__body task-list";

    const items = inbox.filter((x) => x.groupId === g.id);
    items.forEach((item) => body.appendChild(renderItem(item, g.id)));

    const tail = document.createElement("div");
    tail.className = "inbox-drop-tail";
    tail.setAttribute("aria-hidden", "true");
    body.appendChild(tail);

    bindDropBody(body, g.id);

    section.appendChild(head);
    section.appendChild(body);
    els.inboxList.appendChild(section);
  }

  const ungrouped = inbox.filter((x) => !x.groupId);
  const section = document.createElement("div");
  section.className = "inbox-group inbox-group--ungrouped";

  const head = document.createElement("div");
  head.className = "inbox-group__head task-group-heading";
  const title = document.createElement("span");
  title.className = "inbox-group__heading-label";
  title.textContent = "Без группы";
  head.appendChild(title);

  const body = document.createElement("div");
  body.className = "inbox-group__body task-list";

  ungrouped.forEach((item) => body.appendChild(renderItem(item, null)));

  const tail = document.createElement("div");
  tail.className = "inbox-drop-tail";
  tail.setAttribute("aria-hidden", "true");
  body.appendChild(tail);

  bindDropBody(body, null);

  section.appendChild(head);
  section.appendChild(body);
  els.inboxList.appendChild(section);
}
