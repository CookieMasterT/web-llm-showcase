import { DEBUG as DEBUG_VAR } from "../config/constants.js";

function checkDebugEnabled() {
  if (typeof window === "undefined") return false;

  // 1. Check debug variable in localStorage
  if (localStorage.getItem("debug") === "true") {
    return true;
  }

  // 2. Check whether vite is running in debug mode
  if (
    import.meta.env &&
    (import.meta.env.VITE_DEBUG === "true" || import.meta.env.MODE === "debug")
  ) {
    return true;
  }

  // 3. Use the variable in constants.js
  return Boolean(DEBUG_VAR);
}

export let isDebugEnabled = false;

export function initLogging() {
  isDebugEnabled = checkDebugEnabled();

  // Notify debug functionality in the console.
  logger.debug("Debug mode is currently enabled.");

  // Expose function in DevTools console to toggle on/off on the fly
  if (typeof window !== "undefined") {
    window.setDebug = (enabled) => {
      if (enabled) {
        localStorage.setItem("debug", "true");
      } else {
        localStorage.removeItem("debug");
      }
      logger.info(`Debug mode set to: ${enabled}. Refresh the page to apply.`);
    };
  }
}

export const logger = {
  debug: (...args) => {
    if (!isDebugEnabled) return;
    console.log("%c[DEBUG]", "color: #38bdf8; font-weight: bold;", ...args);
  },
  info: (...args) => {
    console.info("%c[INFO]", "color: #34d399; font-weight: bold;", ...args);
  },
  warn: (...args) => {
    console.warn("%c[WARN]", "color: #fbbf24; font-weight: bold;", ...args);
  },
  error: (...args) => {
    console.error("%c[ERROR]", "color: #f87171; font-weight: bold;", ...args);
  },
};
