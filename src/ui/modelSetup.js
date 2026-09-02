import { state } from "../state/appState.js";
import {
  availableModels,
  initializeWebLLMEngine,
} from "../services/webllmEngine.js";

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
    }
  }
}

export function initModelSetup() {
  // Initial populate
  populateModels();

  document.getElementById("model-search").addEventListener("input", (e) => {
    populateModels(e.target.value);
  });

  document.getElementById("download").addEventListener("click", function () {
    const downloadBtn = this;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Downloading...";

    initializeWebLLMEngine()
      .then(() => {
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
        downloadBtn.disabled = false;
        downloadBtn.textContent = "Download";
        console.error(err);
      });
  });
}
