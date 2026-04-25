import { cryptoRandomId } from "../utils/id.js";
import { nowIso } from "../utils/time.js";

export function pushEvent(type, payload = {}) {
  const evt = { id: cryptoRandomId(), type, at: nowIso(), payload };
  if (typeof window !== "undefined" && window?.dispatchEvent && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:event", { detail: evt }));
  }
}
