import * as webllm from "../../web-llm-unlocked/lib/index.js";
import { state } from "../state/appState.js";

export const availableModels = webllm.prebuiltAppConfig.model_list.map(
  (m) => m.model_id,
);

// Callback function for initializing progress
export function updateEngineInitProgressCallback(report) {
  // todo: convert this to a progress bar
  // console.log("initialize", report.progress);
  document.getElementById("download-status").textContent = report.text;
}

// Create engine instance
export const engine = new webllm.MLCEngine();
engine.setInitProgressCallback(updateEngineInitProgressCallback);

export async function initializeWebLLMEngine() {
  document.getElementById("download-status").classList.remove("hidden");
  state.selectedModel = document.getElementById("model-selection").value;
  const config = {
    temperature: 1.0,
    top_p: 1,
  };
  await engine.reload(state.selectedModel, config);
}
