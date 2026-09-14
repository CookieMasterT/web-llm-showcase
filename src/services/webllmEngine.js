import * as webllm from "../../web-llm-unlocked/lib/index.js";
import { state } from "../state/appState.js";
import { logger } from "../utils/logger.js";

export const availableModels = webllm.prebuiltAppConfig.model_list.map(
  (m) => m.model_id,
);

// Callback function for initializing progress
export function updateEngineInitProgressCallback(report) {
  // todo: convert this to a progress bar
  //logger.debug("Engine init progress:", report.progress, report.text);
  document.getElementById("download-status").textContent = report.text;
}

// Create engine instance
export const engine = new webllm.MLCEngine();
engine.setInitProgressCallback(updateEngineInitProgressCallback);

export async function unloadWebLLMEngine() {
  if (state.loadedModel) {
    logger.info("Unloading previous model:", state.loadedModel);
  }
  await engine.unload();
  state.loadedModel = null;
}

export async function initializeWebLLMEngine() {
  const previousModel = state.loadedModel;
  document.getElementById("download-status").classList.remove("hidden");
  state.selectedModel = document.getElementById("model-selection").value;
  if (previousModel) {
    logger.info("Unloading previous model:", previousModel);
  }
  logger.info("Loading model:", state.selectedModel);
  /* This error should be ignored, it is fine
   The error only shows up when we have a previous model loaded
   It shows up beacuse the WebLLM backend unloads the previous model improperly
   causing the "device lost" WebGPU error. It doesn't however matter since
   the device is supposed to be lost (we are unloading the model after all).
  */
  if (previousModel) {
    logger.warn("Ignore the WebGPU error, it is fine.");
  }
  await engine.reload(state.selectedModel);
  state.loadedModel = state.selectedModel;
  logger.info("Model loaded successfully:", state.loadedModel);
}
