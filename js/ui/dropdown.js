export function createDropdown({ value, options, onChange, ariaLabel }) {
  const root = document.createElement("div");
  root.className = "dropdown";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dropdown-button";
  if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);

  const label = document.createElement("span");
  const caret = document.createElement("span");
  caret.className = "dropdown-caret";
  caret.textContent = "▾";
  btn.appendChild(label);
  btn.appendChild(caret);

  const menu = document.createElement("div");
  menu.className = "dropdown-menu";

  const close = () => root.classList.remove("open");
  const open = () => root.classList.add("open");
  const toggle = () => (root.classList.contains("open") ? close() : open());

  const setValue = (v) => {
    const current = v ?? "";
    const selected = options.find((o) => String(o.value) === String(current));
    label.textContent = selected ? selected.label : (options[0]?.label || "—");
    [...menu.children].forEach((c) => c.classList.toggle("active", c.dataset.value === String(current)));
  };

  options.forEach((opt) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "dropdown-item";
    item.textContent = opt.label;
    item.dataset.value = String(opt.value ?? "");
    item.addEventListener("click", () => {
      close();
      onChange(opt.value);
    });
    menu.appendChild(item);
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  const onDocClick = () => close();
  document.addEventListener("click", onDocClick);
  const destroy = () => {
    document.removeEventListener("click", onDocClick);
    close();
  };

  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  root.appendChild(btn);
  root.appendChild(menu);
  setValue(value);

  return { root, setValue, menu, label, destroy };
}

export function enhanceSelect(selectEl) {
  if (!selectEl) return null;
  if (selectEl._dropdownDestroy) {
    selectEl._dropdownDestroy();
    selectEl._dropdownDestroy = null;
  }
  const sibling = selectEl.nextElementSibling;
  if (sibling?.classList?.contains("dropdown")) {
    sibling.remove();
  }
  selectEl.style.display = "";

  const buildOptions = () => [...selectEl.options].map((o) => ({ value: o.value, label: o.textContent }));
  const dd = createDropdown({
    value: selectEl.value,
    options: buildOptions(),
    ariaLabel: selectEl.getAttribute("aria-label") || undefined,
    onChange: (v) => {
      selectEl.value = String(v ?? "");
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      const opts = buildOptions();
      const selected = opts.find((o) => String(o.value) === String(selectEl.value));
      dd.label.textContent = selected ? selected.label : (opts[0]?.label || "—");
      [...dd.menu.children].forEach((c) => c.classList.toggle("active", c.dataset.value === String(selectEl.value)));
    }
  });

  selectEl.style.display = "none";
  selectEl.insertAdjacentElement("afterend", dd.root);
  selectEl._dropdownDestroy = dd.destroy;

  return dd;
}
