let renderAllImpl = () => {};

export function setRenderAll(fn) {
  renderAllImpl = fn;
}

export function renderAll() {
  renderAllImpl();
}
