import * as webllm from "../../web-llm-unlocked/lib/index.js";
import { state } from "../state/appState.js";
import { logger } from "../utils/logger.js";

export const availableModels = webllm.prebuiltAppConfig.model_list.map(
  (m) => m.model_id,
);
export const availableModelCardUrls = new Map(
  webllm.prebuiltAppConfig.model_list.map((model) => [
    model.model_id,
    model.model,
  ]),
);
export const hasModelInCache = webllm.hasModelInCache;

// Callback function for initializing progress
export function updateEngineInitProgressCallback(report) {
  document.dispatchEvent(
    new CustomEvent("model-init-progress", { detail: report }),
  );
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
  state.selectedModel = document.getElementById("model-selection").value;
  logger.info("Loading model:", state.selectedModel);
  await engine.reload(state.selectedModel);
  state.loadedModel = state.selectedModel;
  logger.info("Model loaded successfully:", state.loadedModel);
}
