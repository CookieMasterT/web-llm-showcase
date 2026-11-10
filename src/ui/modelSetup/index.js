import { state } from "../../state/appState.js";
import { logger } from "../../utils/logger.js";
import { availableModels } from "../../services/webllmEngine.js";
import {
  initDownloadStep,
  showModelDetails,
  updateDownloadButtonState,
} from "./downloadStep.js";
import { initModelStep, showSeries } from "./modelStep.js";
import { initSeriesStep, renderLanding } from "./seriesStep.js";
import { allModelGroups, setupViewState } from "./shared.js";

function onSelectModel(model, returnPage) {
  showModelDetails(model, returnPage, { updateDownloadButtonState });
}

function onSelectSeries(series, options = {}) {
  showSeries(series, { ...options, onSelectModel });
}

function refreshModelChoiceViews() {
  renderLanding(onSelectModel, onSelectSeries);
  if (setupViewState.currentSeriesId) {
    const series = allModelGroups.find(
      (entry) => entry.id === setupViewState.currentSeriesId,
    );
    if (
      series &&
      !document.getElementById("series-models").classList.contains("hidden")
    ) {
      showSeries(series, {
        preserveScroll: true,
        onSelectModel,
      });
    }
  }
  if (
    setupViewState.currentModel &&
    !document.getElementById("model-details").classList.contains("hidden")
  ) {
    const selectedVariant = document.getElementById("model-selection").value;
    if (setupViewState.currentModel.variants.includes(selectedVariant)) {
      state.selectedModel = selectedVariant;
    }
    showModelDetails(
      setupViewState.currentModel,
      setupViewState.modelDetailsReturnPage,
      {
        preserveScroll: true,
        updateDownloadButtonState,
      },
    );
    const select = document.getElementById("model-selection");
    if (setupViewState.currentModel.variants.includes(selectedVariant)) {
      select.value = selectedVariant;
      state.selectedModel = selectedVariant;
    }
    updateDownloadButtonState();
  }
}

export function initModelSetup() {
  initSeriesStep(onSelectModel, onSelectSeries);
  initModelStep();
  initDownloadStep({
    showSeries: onSelectSeries,
    refreshModelChoiceViews,
  });
  logger.debug(
    "Model setup initialized. Available models:",
    availableModels.length,
  );
}

export { updateDownloadButtonState };
