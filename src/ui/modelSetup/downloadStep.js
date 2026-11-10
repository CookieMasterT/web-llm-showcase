import { state } from "../../state/appState.js";
import modelData from "../../models/model_data.json";
import {
  engine,
  hasModelInCache,
  initializeWebLLMEngine,
} from "../../services/webllmEngine.js";
import { allowNavigation } from "../navigation.js";
import { logger } from "../../utils/logger.js";
import { reportError } from "../../utils/errorHandler.js";
import {
  addModelBadges,
  allModelGroups,
  cachedVariants,
  getTaskLabel,
  getWorkspace,
  isModelLoaded,
  isVariantRecent,
  makeExternalLink,
  modelByVariant,
  saveRecentModel,
  setupCacheState,
  setupViewState,
  showPage,
} from "./shared.js";

const CACHE_CHECK_CONCURRENCY = 8;

function formatVariant(variantId) {
  const match = variantId.match(
    /-q([04])f(16|32)(?:_1)?-MLC(?:-1k)?(?:-b(\d+))?$/i,
  );
  if (!match) return "WebLLM model format";

  const [, precision, compute, batchSize] = match;
  const labels = [
    modelData.variantLegend[`q${precision}`],
    modelData.variantLegend[`f${compute}`],
  ];
  if (/-1k(?:-|$)/i.test(variantId)) {
    labels.push(modelData.variantLegend["-1k"]);
  }
  if (batchSize) {
    labels.push(modelData.variantLegend[`b${batchSize}`]);
  }
  return labels.map((label) => label.replace(/\.$/, "")).join(" · ");
}

function getPreferredVariant(model) {
  const selectedModel = model.variants.includes(state.selectedModel)
    ? state.selectedModel
    : null;
  if (selectedModel) return selectedModel;

  return [...model.variants].sort((a, b) => {
    const cachedDifference =
      Number(cachedVariants.has(b)) - Number(cachedVariants.has(a));
    if (cachedDifference) return cachedDifference;
    const recentDifference =
      Number(isVariantRecent(b)) - Number(isVariantRecent(a));
    if (recentDifference) return recentDifference;
    const preferredFormat = (variant) =>
      /-q4f16_1-MLC(?:-|$)/i.test(variant) ? 0 : 1;
    return preferredFormat(a) - preferredFormat(b);
  })[0];
}

export function showModelDetails(
  model,
  returnPage,
  { preserveScroll = false, updateDownloadButtonState } = {},
) {
  const workspace = getWorkspace();
  const previousScrollTop = workspace.scrollTop;
  if (!preserveScroll) {
    if (returnPage === "series") {
      setupViewState.seriesScrollTop = workspace.scrollTop;
    } else {
      setupViewState.landingScrollTop = workspace.scrollTop;
    }
  }
  setupViewState.currentModel = model;
  setupViewState.modelDetailsReturnPage = returnPage;
  const content = document.getElementById("model-detail-content");
  content.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "model-detail-heading";
  if (isModelLoaded(model)) heading.classList.add("loaded-model-card");
  const header = document.createElement("div");
  header.className = "model-detail-header";
  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = model.name;
  const metadata = document.createElement("p");
  metadata.className = "model-detail-metadata";
  metadata.textContent = `${model.creator ? `${model.creator} · ` : ""}${model.parameterCount} parameters · ${getTaskLabel(model.task)}`;
  titleBlock.append(title, metadata);
  const badges = document.createElement("div");
  badges.className = "model-badges";
  addModelBadges(badges, model);
  header.append(titleBlock, badges);
  heading.append(header);

  if (model.description) {
    const description = document.createElement("p");
    description.className = "model-detail-description";
    description.textContent = model.description;
    heading.append(description);
  }

  if (model.chatModel === false) {
    const note = document.createElement("p");
    note.className = "model-task-note";
    note.textContent =
      "This is an embedding model, not a chat model. It can be initialized, but it does not generate chat responses in the showcase.";
    heading.append(note);
  }

  const modelLink = makeExternalLink(
    model.modelCardUrl,
    "Read model card",
    "model-detail-link",
  );
  if (modelLink) heading.append(modelLink);

  const technicalDetails = document.createElement("details");
  technicalDetails.className = "variant-technical-details";
  const technicalSummary = document.createElement("summary");
  technicalSummary.textContent = "Technical model IDs";
  const technicalList = document.createElement("ul");
  for (const variant of model.variants) {
    const item = document.createElement("li");
    item.textContent = variant;
    technicalList.append(item);
  }
  technicalDetails.append(technicalSummary, technicalList);
  heading.append(technicalDetails);
  content.append(heading);

  const select = document.getElementById("model-selection");
  select.replaceChildren();
  const preferredVariant = getPreferredVariant(model);
  for (const variant of model.variants) {
    const option = document.createElement("option");
    option.value = variant;
    const tags = [];
    if (variant === state.loadedModel) {
      tags.push("Currently loaded");
    } else if (cachedVariants.has(variant)) {
      tags.push("Already downloaded");
    } else if (isVariantRecent(variant)) tags.push("Recently used");
    option.textContent = `${formatVariant(variant)}${
      tags.length ? ` · ${tags.join(" · ")}` : ""
    }`;
    option.title = variant;
    select.append(option);
  }
  if (preferredVariant) select.value = preferredVariant;
  select.disabled = state.isDownloading;
  state.selectedModel = select.value;

  if (!state.isDownloading) {
    document.getElementById("download-status").classList.add("hidden");
  }
  showPage("model-details");
  if (preserveScroll) {
    requestAnimationFrame(() => {
      workspace.scrollTop = previousScrollTop;
    });
  } else {
    workspace.scrollTop = 0;
  }
  updateDownloadButtonState();
}

export function updateDownloadButtonState() {
  const downloadBtn = document.getElementById("download");
  const select = document.getElementById("model-selection");
  if (!downloadBtn || !select) return;

  const currentSelection = select.value;
  const modelIsLoaded =
    state.loadedModel && currentSelection === state.loadedModel;
  const modelIsDownloaded = cachedVariants.has(currentSelection);

  if (state.isDownloading) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Downloading";
    downloadBtn.title = "";
    downloadBtn.classList.add("downloading");
  } else if (modelIsLoaded) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Loaded";
    downloadBtn.title = "This model is already loaded.";
    downloadBtn.classList.remove("downloading");
  } else if (modelIsDownloaded) {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Load";
    downloadBtn.title = "Load this downloaded model.";
    downloadBtn.classList.remove("downloading");
  } else {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download";
    downloadBtn.title = "";
    downloadBtn.classList.remove("downloading");
  }
}

function setSetupControlsDisabled(disabled) {
  document
    .querySelectorAll(
      "#setup-view button, #setup-view input, #setup-view select",
    )
    .forEach((control) => {
      control.disabled = disabled;
    });
}

async function updateCachedVariants(refreshModelChoiceViews) {
  const modelIds = [...new Set(modelByVariant.keys())];
  const errors = [];
  for (
    let index = 0;
    index < modelIds.length;
    index += CACHE_CHECK_CONCURRENCY
  ) {
    const batch = modelIds.slice(index, index + CACHE_CHECK_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((modelId) => hasModelInCache(modelId)),
    );
    results.forEach((result, offset) => {
      if (result.status === "fulfilled") {
        if (result.value) cachedVariants.add(batch[offset]);
      } else {
        errors.push(result.reason);
      }
    });
  }

  setupCacheState.status = errors.length ? "partial" : "complete";
  logger.info(
    `Checked browser cache for ${modelIds.length} model variants; ${cachedVariants.size} are cached.`,
  );
  if (errors.length) {
    logger.error("Some cached model checks failed:", errors);
    reportError(
      errors[0],
      `Could not check which models are already downloaded (${errors.length} variant${
        errors.length === 1 ? "" : "s"
      })`,
    );
  }
  refreshModelChoiceViews();
}

function startDownload(refreshModelChoiceViews) {
  if (state.isDownloading) return;
  if (state.loadedModel && state.selectedModel === state.loadedModel) return;

  const downloadingModel = state.selectedModel;
  const model = modelByVariant.get(downloadingModel);
  if (!model) {
    reportError(
      new Error(`No model details found for ${downloadingModel}.`),
      "Model selection failed",
    );
    return;
  }

  state.isDownloading = true;
  setSetupControlsDisabled(true);
  updateDownloadButtonState();
  allowNavigation(false);

  const sendBtn = document.getElementById("send");
  if (sendBtn) sendBtn.disabled = true;

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
      setSetupControlsDisabled(false);
      saveRecentModel(model, downloadingModel);
      cachedVariants.add(downloadingModel);
      refreshModelChoiceViews();
      updateDownloadButtonState();
      if (sendBtn) sendBtn.disabled = false;
      allowNavigation(true);
    })
    .catch((error) => {
      logger.error("Model download failed:", error);
      reportError(error, "Model download failed");
      state.isDownloading = false;
      setSetupControlsDisabled(false);
      allowNavigation(state.loadedModel !== null);
      updateDownloadButtonState();
      if (sendBtn) sendBtn.disabled = state.loadedModel === null;
    });
}

export function initDownloadStep({ showSeries, refreshModelChoiceViews }) {
  document
    .getElementById("model-selection")
    .addEventListener("change", (event) => {
      state.selectedModel = event.target.value;
      updateDownloadButtonState();
    });

  document.getElementById("back-to-models").addEventListener("click", () => {
    if (
      setupViewState.modelDetailsReturnPage === "series" &&
      setupViewState.currentSeriesId
    ) {
      const series = allModelGroups.find(
        (entry) => entry.id === setupViewState.currentSeriesId,
      );
      if (series) {
        showSeries(series, { preserveScroll: true });
        return;
      }
    }
    showPage("setup-landing");
    getWorkspace().scrollTop = setupViewState.landingScrollTop;
  });

  document
    .getElementById("download")
    .addEventListener("click", () => startDownload(refreshModelChoiceViews));
  updateDownloadButtonState();
  updateCachedVariants(refreshModelChoiceViews);
}
