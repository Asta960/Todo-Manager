import { state } from "../state.js";

export async function persist() {
  if (!state.data) return;
  await window.electronAPI.saveData(state.data);
}
