import { state } from "../state/appState.js";
import {
  availableModels,
  initializeWebLLMEngine,
  engine,
} from "../services/webllmEngine.js";
import { allowNavigation } from "./navigation.js";
import { logger } from "../utils/logger.js";

export function updateDownloadButtonState() {
  const downloadBtn = document.getElementById("download");
  const select = document.getElementById("model-selection");
  if (!downloadBtn || !select) return;

  const currentSelection = select.value;

  if (state.isDownloading) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Downloading";
    downloadBtn.title = "";
    downloadBtn.classList.add("downloading");
  } else if (state.loadedModel && currentSelection === state.loadedModel) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Download";
    downloadBtn.title =
      "This model is currently downloaded, please choose another model to download.";
    downloadBtn.classList.remove("downloading");
  } else {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download";
    downloadBtn.title = "";
    downloadBtn.classList.remove("downloading");
  }
}

export function populateModels(filterQuery = "") {
  const select = document.getElementById("model-selection");
  select.innerHTML = "";
  availableModels.forEach((modelId) => {
    if (modelId.toLowerCase().includes(filterQuery.toLowerCase())) {
      const option = document.createElement("option");
      option.value = modelId;
      option.textContent = modelId;
      select.appendChild(option);
    }
  });
  if (select.options.length > 0) {
    if ([...select.options].some((opt) => opt.value === state.selectedModel)) {
      select.value = state.selectedModel;
    } else {
      select.selectedIndex = 0;
      state.selectedModel = select.value;
      logger.debug(
        "Selected model not in filtered list, defaulting to:",
        state.selectedModel,
      );
    }
  }
  updateDownloadButtonState();
}

export function initModelSetup() {
  const modelSearch = document.getElementById("model-search");
  const modelSelect = document.getElementById("model-selection");

  // Initial populate, using the search query when it is not empty.
  populateModels(modelSearch.value);
  logger.debug(
    "Model setup initialized. Available models:",
    availableModels.length,
  );

  modelSearch.addEventListener("input", (e) => {
    logger.debug("Model search filter changed:", e.target.value);
    populateModels(e.target.value);
  });

  modelSelect.addEventListener("change", (e) => {
    state.selectedModel = e.target.value;
    logger.debug("Model selection changed to:", state.selectedModel);
    updateDownloadButtonState();
  });

  document.getElementById("download").addEventListener("click", function () {
    if (state.isDownloading) return;
    if (state.loadedModel && state.selectedModel === state.loadedModel) return;

    const downloadingModel = state.selectedModel;
    state.isDownloading = true;
    modelSelect.disabled = true;
    modelSearch.disabled = true;
    updateDownloadButtonState();

    // Prevent navigation to chat/insights while old model unloads & new one downloads
    allowNavigation(false);

    // Disable chat input send button if active
    const sendBtn = document.getElementById("send");
    if (sendBtn) {
      sendBtn.disabled = true;
    }

    // Stop any ongoing inference before switching/unloading models
    if (state.isInferring) {
      state.isStopped = true;
      state.isPaused = false;
      engine.interruptGenerate();
    }

    logger.info("Download initiated for model:", downloadingModel);

    initializeWebLLMEngine(downloadingModel)
      .then(() => {
        logger.info("Model download complete.");
        state.isDownloading = false;
        modelSelect.disabled = false;
        modelSearch.disabled = false;
        updateDownloadButtonState();

        if (sendBtn) {
          sendBtn.disabled = false;
        }

        // Enable chat & insights navigation
        allowNavigation(true);

        // Auto-switch to chat view (disabled, user has to navigate manually)
        /*const chatNav = document.getElementById("nav-chat");
        if (chatNav) {
          chatNav.click();
        }*/
      })
      .catch((err) => {
        logger.error("Model download failed:", err);
        state.isDownloading = false;
        modelSelect.disabled = false;
        modelSearch.disabled = false;
        // Navigation remains blocked if no model is loaded
        allowNavigation(state.loadedModel !== null);
        updateDownloadButtonState();
      });
  });
}
