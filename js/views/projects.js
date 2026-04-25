import { state } from "../state.js";
import { els } from "../dom.js";
import { cryptoRandomId } from "../utils/id.js";
import { nowIso } from "../utils/time.js";
import { pushEvent } from "../data/events.js";
import { persist } from "../data/persist.js";
import { renderAll } from "../renderLoop.js";
import { makeTaskRow } from "../components/taskRows.js";
import { enhanceSelect } from "../ui/dropdown.js";

function projectTaskStats(projectId) {
  const tasks = state.data.tasks.filter((t) => t.projectId === projectId);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  return { total, done, pct, complete };
}

export async function deleteProject(projectId) {
  const project = state.data.projects.find((p) => p.id === projectId);
  if (!project) return;
  state.data.tasks
    .filter((t) => t.projectId === projectId)
    .forEach((t) => pushEvent("task_deleted", { taskId: t.id }));
  state.data.tasks = state.data.tasks.filter((t) => t.projectId !== projectId);
  state.data.projects = state.data.projects.filter((p) => p.id !== projectId);
  if (state.activeProjectId === projectId) {
    state.activeProjectId = state.data.projects[0]?.id || null;
    state.projectsMode = "list";
  }
  pushEvent("project_deleted", { projectId });
  await persist();
  renderAll();
}

export function renderProjects() {
  const projects = state.data.projects;
  if (!projects.length) {
    state.activeProjectId = null;
    state.projectsMode = "list";
  } else if (state.projectsMode === "detail") {
    const ok = state.activeProjectId && projects.some((p) => p.id === state.activeProjectId);
    if (!ok) {
      state.activeProjectId = null;
      state.projectsMode = "list";
    }
  }

  const showList = state.projectsMode !== "detail";
  if (els.projectsListScreen) els.projectsListScreen.classList.toggle("is-hidden", !showList);
  if (els.projectDetailScreen) els.projectDetailScreen.classList.toggle("is-hidden", showList);

  if (els.projectTagSelect) {
    const tags = state.data.tags || [];
    const sig = tags.map((t) => t.id).join("|");
    if (els.projectTagSelect.dataset.tagsSig !== sig) {
      const prev = els.projectTagSelect.value;
      els.projectTagSelect.innerHTML = "<option value=\"\">Тег</option>";
      tags.forEach((tag) => {
        const opt = document.createElement("option");
        opt.value = tag.id;
        opt.textContent = tag.title;
        els.projectTagSelect.appendChild(opt);
      });
      els.projectTagSelect.value = prev && tags.some((t) => t.id === prev) ? prev : "";
      enhanceSelect(els.projectTagSelect);
      els.projectTagSelect.dataset.tagsSig = sig;
    }
  }

  if (showList) {
    if (els.projectDetails) els.projectDetails.innerHTML = "";
    els.projectsList.innerHTML = "";
    if (!projects.length) {
      els.projectsList.className = "project-list project-list--empty";
      els.projectsList.textContent = "Проектов пока нет.";
      return;
    }
    els.projectsList.className = "project-list";

    projects.forEach((proj) => {
      const { pct, complete } = projectTaskStats(proj.id);

      const row = document.createElement("div");
      row.className = "project-list-row";

      const main = document.createElement("button");
      main.type = "button";
      main.className = "project-item project-item--main";
      main.setAttribute("aria-label", `Открыть проект ${proj.title}`);

      const titleEl = document.createElement("span");
      titleEl.className = "project-item__title";
      titleEl.textContent = complete ? `${proj.title} ✓` : proj.title;

      const track = document.createElement("div");
      track.className = "project-item__track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(pct));
      track.setAttribute("aria-label", `Прогресс: ${pct}%`);

      const fill = document.createElement("div");
      fill.className = "project-item__fill";
      fill.style.width = `${pct}%`;

      track.appendChild(fill);
      main.appendChild(titleEl);
      main.appendChild(track);

      main.addEventListener("click", () => {
        state.activeProjectId = proj.id;
        state.projectsMode = "detail";
        renderAll();
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-delete";
      delBtn.textContent = "Удалить";
      delBtn.setAttribute("aria-label", `Удалить проект ${proj.title}`);
      delBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteProject(proj.id);
      });

      row.appendChild(main);
      row.appendChild(delBtn);
      els.projectsList.appendChild(row);
    });
    return;
  }

  const project = projects.find((p) => p.id === state.activeProjectId);
  if (!project) {
    state.projectsMode = "list";
    renderAll();
    return;
  }

  if (els.projectDetailTitle) els.projectDetailTitle.textContent = project.title;
  const tasks = state.data.tasks.filter((t) => t.projectId === project.id);

  const details = document.createElement("div");
  details.className = "project-details";

  const addWrap = document.createElement("div");
  addWrap.className = "quick-add quick-add--pair";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Новая задача в проект (Enter)";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-accent";
  addBtn.textContent = "Добавить";

  const addProjectTask = async () => {
    const title = input.value.trim();
    if (!title) return;
    const task = {
      id: cryptoRandomId(),
      title,
      note: "",
      status: "next",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      projectId: project.id,
      tagId: null,
      groupId: null,
      doneAt: null
    };
    state.data.tasks.unshift(task);
    input.value = "";
    pushEvent("task_created", { taskId: task.id, projectId: project.id });
    await persist();
    renderAll();
  };

  addBtn.addEventListener("click", addProjectTask);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addProjectTask();
  });

  addWrap.appendChild(input);
  addWrap.appendChild(addBtn);

  const divider = document.createElement("hr");
  divider.className = "divider project-detail-divider";

  const list = document.createElement("div");
  list.className = "task-list";
  if (!tasks.length) {
    list.className = "list-empty-hint";
    list.textContent = "В проекте пока нет задач.";
  } else {
    list.className = "task-list";
    tasks.forEach((t) => list.appendChild(makeTaskRow(t, { compact: true })));
  }

  details.appendChild(addWrap);
  details.appendChild(divider);
  details.appendChild(list);

  els.projectDetails.innerHTML = "";
  els.projectDetails.appendChild(details);
}
