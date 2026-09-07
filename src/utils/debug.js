import { engine } from "../services/webllmEngine.js";
import { state } from "../state/appState.js";

// Query definitions
// Each entry: { fn: Function, description: string }

const QUERIES = {
  appState: {
    description:
      "Print the current application state (pause / stop flags, selected model).",
    fn() {
      console.group("%c[query.appState]", "color: #a78bfa; font-weight: bold;");
      console.log("selectedModel :", state.selectedModel);
      console.log("isPaused      :", state.isPaused);
      console.log("isStopped     :", state.isStopped);
      console.groupEnd();
      return { ...state };
    },
  },

  completionStatus: {
    description:
      "Print live details of the active completion (null when idle).",
    fn: async () => {
      console.group(
        "%c[query.completionStatus]",
        "color: #a78bfa; font-weight: bold;",
      );
      const c = state;
      if (c === null) {
        console.log("completion: null (no active generation)");
        console.groupEnd();
        return null;
      }
      console.log("completion object :", c);
      console.log(
        "model             :",
        c.selectedModel ?? "(not yet available)",
      );
      console.log("isPaused          :", c.isPaused ?? "(not yet available)");
      console.log("isStopped         :", c.isStopped ?? "(not yet available)");
      console.log("current message   :", await engine.getMessage());

      console.groupEnd();
      return c;
    },
  },

  help: {
    description: "List all available query commands.",
    fn() {
      console.group(
        "%c[query.help] — Available commands",
        "color: #a78bfa; font-weight: bold;",
      );
      for (const [name, { description }] of Object.entries(QUERIES)) {
        console.log(
          `  %cquery.${name}()%c — ${description}`,
          "color: #38bdf8;",
          "color: inherit;",
        );
      }
      console.groupEnd();
    },
  },

  // Add new queries here following the same pattern:
  /*
  myQuery: {
    description: "What this query does.",
    fn() { },
  },
  */
};

export function initDebugConsole() {
  if (typeof window === "undefined") return;

  const query = {};

  // Attach each query function directly.
  for (const [name, { fn }] of Object.entries(QUERIES)) {
    query[name] = fn;
  }

  window.query = query;

  // Print a one-liner hint so developers know the namespace exists.
  console.info(
    "%c[WebLLM Showcase] %cType %cquery.help()%c in the console to explore debug commands or %csetDebug(true)%c to enable debug mode.",
    "color: #34d399; font-weight: bold;",
    "color: inherit;",
    "color: #38bdf8; font-weight: bold;",
    "color: inherit;",
    "color: #38bdf8; font-weight: bold;",
    "color: inherit;",
  );
}
