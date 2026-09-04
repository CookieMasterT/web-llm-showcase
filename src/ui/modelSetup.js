import { state } from "../state/appState.js";
import {
  availableModels,
  initializeWebLLMEngine,
} from "../services/webllmEngine.js";
import { logger } from "../utils/logger.js";

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
}

export function initModelSetup() {
  const modelSearch = document.getElementById("model-search");

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

  document.getElementById("download").addEventListener("click", function () {
    const downloadBtn = this;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Downloading...";
    logger.info("Download initiated for model:", state.selectedModel);

    initializeWebLLMEngine()
      .then(() => {
        logger.info("Model download complete. Switching to chat view.");
        downloadBtn.textContent = "Downloaded";
        document.getElementById("send").disabled = false;

        // Enable chat & insights tabs
        const chatNav = document.getElementById("nav-chat");
        chatNav.removeAttribute("disabled");
        chatNav.removeAttribute("title");
        document.getElementById("nav-insights").removeAttribute("disabled");

        // Auto-switch to chat view
        chatNav.click();
      })
      .catch((err) => {
        logger.error("Model download failed:", err);
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Download";
      });
  });
}
