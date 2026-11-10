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
const PROGRESS_REFRESH_INTERVAL = 1000;
const progressStages = new Map();
let progressTimer = null;
let activeProgressPhase = null;
let cachedBeforeLoad = false;

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

function getProgressStage(phase) {
  if (!progressStages.has(phase)) {
    const element = document.querySelector(
      `#download-status [data-phase="${phase}"]`,
    );
    progressStages.set(phase, {
      element,
      bar: element.querySelector(".segmented-progress"),
      state: element.querySelector(".loading-step-state"),
      count: element.querySelector(".loading-count"),
      elapsed: element.querySelector(".loading-elapsed"),
      eta: element.querySelector(".loading-eta"),
      startedAt: null,
      completed: 0,
      total: 0,
    });
  }
  return progressStages.get(phase);
}

function formatDuration(seconds) {
  const roundedSeconds = Math.max(0, Math.ceil(seconds));
  if (roundedSeconds < 60) return `${roundedSeconds} sec`;
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return remainingSeconds
    ? `${minutes} min ${remainingSeconds} sec`
    : `${minutes} min`;
}

function updateProgressBar(stage, completed, total) {
  if (stage.total !== total) {
    stage.total = total;
    const segments = document.createDocumentFragment();
    for (let index = 0; index < total; index += 1) {
      const segment = document.createElement("span");
      segment.className = "progress-segment";
      segment.setAttribute("aria-hidden", "true");
      segments.append(segment);
    }
    stage.bar.replaceChildren(segments);
    stage.bar.setAttribute("aria-valuemax", String(total));
  }

  stage.completed = Math.min(completed, total);
  [...stage.bar.children].forEach((segment, index) => {
    segment.classList.toggle("is-filled", index < stage.completed);
  });
  stage.bar.setAttribute("aria-valuenow", String(stage.completed));
  stage.bar.setAttribute(
    "aria-valuetext",
    `${stage.completed} of ${stage.total} model shards`,
  );
  stage.count.textContent = `${stage.completed} of ${stage.total} shards`;
}

function updateProgressTiming(phase, now = performance.now()) {
  const stage = getProgressStage(phase);
  if (stage.startedAt === null) return;

  const elapsed = (now - stage.startedAt) / 1000;
  stage.elapsed.textContent = `Elapsed: ${formatDuration(elapsed)}`;
  if (stage.state.dataset.status === "complete") {
    stage.eta.textContent = "Complete";
    return;
  }
  if (
    stage.state.textContent === "Finishing setup" ||
    (stage.total > 0 && stage.completed >= stage.total)
  ) {
    stage.eta.textContent = "Estimated time remaining: finishing setup…";
    return;
  }

  const remaining =
    stage.completed > 0 && stage.total > stage.completed
      ? elapsed * (stage.total / stage.completed - 1)
      : null;
  stage.eta.textContent =
    remaining === null
      ? "Estimated time remaining: Calculating…"
      : `Estimated time remaining: about ${formatDuration(remaining)}`;
}

function setProgressStageState(phase, status, statusText) {
  const stage = getProgressStage(phase);
  stage.element.dataset.status = status;
  stage.state.textContent = statusText;
  stage.element.classList.toggle("is-active", status === "active");
  stage.element.classList.toggle("is-complete", status === "complete");
}

function markStageComplete(phase, { skipped = false } = {}) {
  const stage = getProgressStage(phase);
  if (skipped && stage.total === 0) {
    updateProgressBar(stage, 1, 1);
    stage.count.textContent = "Already downloaded";
  }
  if (stage.startedAt !== null) {
    updateProgressTiming(phase);
  }
  setProgressStageState(
    phase,
    "complete",
    skipped ? "Already downloaded" : "Loaded",
  );
  stage.eta.textContent = skipped
    ? "Skipped, because this model has already been downloaded"
    : "Complete";
}

function activateProgressStage(phase) {
  const stage = getProgressStage(phase);
  if (activeProgressPhase === phase && stage.startedAt !== null) return;

  if (activeProgressPhase && activeProgressPhase !== phase) {
    markStageComplete(activeProgressPhase, {
      skipped: activeProgressPhase === "download" && cachedBeforeLoad,
    });
  }

  activeProgressPhase = phase;
  stage.startedAt = performance.now();
  setProgressStageState(phase, "active", "In progress");
  updateProgressTiming(phase);
}

function showModelProgress(modelId) {
  const status = document.getElementById("download-status");
  status.dataset.modelId = modelId;
  status.classList.remove("hidden");
  status.querySelector(".download-complete").classList.add("hidden");
  status.querySelector(".model-size").classList.add("hidden");
  document.getElementById("proceed-to-chat").classList.add("hidden");
  activeProgressPhase = null;
  cachedBeforeLoad = false;

  for (const phase of ["download", "load"]) {
    const stage = getProgressStage(phase);
    stage.startedAt = null;
    stage.completed = 0;
    stage.total = 0;
    stage.bar.replaceChildren();
    stage.bar.setAttribute("aria-valuemax", "1");
    stage.bar.setAttribute("aria-valuenow", "0");
    stage.bar.removeAttribute("aria-valuetext");
    stage.count.textContent = "Waiting for progress";
    stage.elapsed.textContent = "Elapsed: 0 sec";
    stage.eta.textContent = "Estimated time remaining: Calculating…";
    setProgressStageState(phase, "waiting", "Waiting");
  }
  getProgressStage("download").state.textContent = "Checking browser storage…";
}

function beginModelProgress(isCached) {
  cachedBeforeLoad = isCached;
  if (isCached) {
    markStageComplete("download", { skipped: true });
    activateProgressStage("load");
  } else {
    activateProgressStage("download");
  }

  progressTimer = window.setInterval(() => {
    if (activeProgressPhase) updateProgressTiming(activeProgressPhase);
  }, PROGRESS_REFRESH_INTERVAL);
}

function onModelInitProgress(event) {
  const report = event.detail;
  if (!report || typeof report.text !== "string") return;

  const shardProgress = report.text.match(/\[(\d+)\s*\/\s*(\d+)\]/);

  /*
  Estimate model size code, do not apply until size management system
  const sizeProgress = report.text.match(/([\d.]+)MB (?:fetched|loaded)/);

  const modelSize = document.querySelector(".model-size");
  if (sizeProgress && shardProgress && modelSize.classList.contains("hidden")) {
    const bytesPerShard =
      (Number(sizeProgress[1]) * 1024 * 1024) / Number(shardProgress[1]);
    const estimatedMegabytes =
      (bytesPerShard * Number(shardProgress[2])) / (1024 * 1024);
    const estimatedSize =
      estimatedMegabytes >= 1024
        ? `${(estimatedMegabytes / 1024).toFixed(1)} GB`
        : `${Math.round(estimatedMegabytes)} MB`;
    modelSize.querySelector("span").textContent = `about ${estimatedSize}`;
    modelSize.classList.remove("hidden");
  }
    */

  if (report.text.startsWith("Fetching param cache")) {
    if (cachedBeforeLoad && activeProgressPhase === "load") {
      const downloadStage = getProgressStage("download");
      downloadStage.startedAt = null;
      downloadStage.completed = 0;
      downloadStage.total = 0;
      downloadStage.bar.replaceChildren();
    }
    cachedBeforeLoad = false;
    activateProgressStage("download");
    if (shardProgress) {
      updateProgressBar(
        getProgressStage("download"),
        Number(shardProgress[1]),
        Number(shardProgress[2]),
      );
      updateProgressTiming("download");
    }
  } else if (report.text.startsWith("Loading model from cache")) {
    if (activeProgressPhase === "download") {
      markStageComplete("download");
    } else if (cachedBeforeLoad) {
      const downloadStage = getProgressStage("download");
      updateProgressBar(
        downloadStage,
        Number(shardProgress?.[2] ?? 1),
        Number(shardProgress?.[2] ?? 1),
      );
      markStageComplete("download", { skipped: true });
    }
    activateProgressStage("load");
    if (shardProgress) {
      updateProgressBar(
        getProgressStage("load"),
        Number(shardProgress[1]),
        Number(shardProgress[2]),
      );
      updateProgressTiming("load");
    }
  } else if (report.text.startsWith("Finish loading on ")) {
    if (activeProgressPhase === "download") {
      markStageComplete("download");
    }
    activateProgressStage("load");
    setProgressStageState("load", "active", "Finishing setup");
    updateProgressTiming("load");
  }
}

function completeModelProgress() {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
  if (activeProgressPhase) {
    const stage = getProgressStage(activeProgressPhase);
    if (stage.total > 0) updateProgressBar(stage, stage.total, stage.total);
    markStageComplete(activeProgressPhase);
  }
  for (const phase of ["download", "load"]) {
    const stage = getProgressStage(phase);
    if (stage.state.dataset.status !== "complete") {
      markStageComplete(phase, {
        skipped: phase === "download" && cachedBeforeLoad,
      });
    }
  }
  document.getElementById("download-status").dataset.modelId =
    state.selectedModel;
  document
    .getElementById("download-status")
    .querySelector(".download-complete")
    .classList.remove("hidden");
  document.getElementById("proceed-to-chat").classList.remove("hidden");
  activeProgressPhase = null;
}

function clearModelProgress() {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
  document.getElementById("download-status").classList.add("hidden");
  activeProgressPhase = null;
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
    downloadBtn.textContent = "Preparing…";
    downloadBtn.title = "";
  } else if (modelIsLoaded) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Loaded";
    downloadBtn.title = "This model is already loaded.";
  } else if (modelIsDownloaded) {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Load";
    downloadBtn.title = "Load this downloaded model.";
  } else {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download";
    downloadBtn.title = "";
  }

  if (
    !state.isDownloading &&
    document.getElementById("download-status").dataset.modelId !==
      currentSelection
  ) {
    document.getElementById("download-status").classList.add("hidden");
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

async function startDownload(refreshModelChoiceViews) {
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
  showModelProgress(downloadingModel);

  const sendBtn = document.getElementById("send");
  if (sendBtn) sendBtn.disabled = true;

  if (state.isInferring) {
    state.isStopped = true;
    state.isPaused = false;
    engine.interruptGenerate();
  }

  try {
    const isCached = await hasModelInCache(downloadingModel);
    if (isCached) cachedVariants.add(downloadingModel);
    else cachedVariants.delete(downloadingModel);
    logger.info(
      isCached ? "Loading stored model:" : "Downloading model:",
      downloadingModel,
    );
    beginModelProgress(isCached);
    await initializeWebLLMEngine(downloadingModel);
    logger.info("Model loaded successfully.");
    state.isDownloading = false;
    setSetupControlsDisabled(false);
    saveRecentModel(model, downloadingModel);
    cachedVariants.add(downloadingModel);
    completeModelProgress();
    refreshModelChoiceViews();
    updateDownloadButtonState();
    if (sendBtn) sendBtn.disabled = false;
    allowNavigation(true);
  } catch (error) {
    logger.error("Model loading failed:", error);
    reportError(error, "Model loading failed");
    state.isDownloading = false;
    setSetupControlsDisabled(false);
    clearModelProgress();
    allowNavigation(state.loadedModel !== null);
    updateDownloadButtonState();
    if (sendBtn) sendBtn.disabled = state.loadedModel === null;
  }
}

export function initDownloadStep({ showSeries, refreshModelChoiceViews }) {
  document
    .getElementById("model-selection")
    .addEventListener("change", (event) => {
      state.selectedModel = event.target.value;
      updateDownloadButtonState();
    });
  document.addEventListener("model-init-progress", onModelInitProgress);
  document.getElementById("proceed-to-chat").addEventListener("click", () => {
    document.getElementById("nav-chat").click();
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
