import { state } from "../state/appState.js";
import modelData from "../models/model_data.json";
import {
  availableModels,
  availableModelCardUrls,
  engine,
  hasModelInCache,
  initializeWebLLMEngine,
} from "../services/webllmEngine.js";
import { allowNavigation } from "./navigation.js";
import { logger } from "../utils/logger.js";
import { reportError } from "../utils/errorHandler.js";

const RECENT_MODELS_COOKIE = "webllm-recent-models";
const MAX_RECENT_MODELS = 5;
const CACHE_CHECK_CONCURRENCY = 8;
const availableModelSet = new Set(availableModels);
const recentModels = readRecentModels();
const cachedVariants = new Set();
const recommendedModelIds = new Set(modelData.recommended_models);
const modelSeriesById = new Map();
const modelById = new Map();
const modelByVariant = new Map();

let currentSeriesId = null;
let currentModel = null;
let modelDetailsReturnPage = "landing";
let cacheCheckStatus = "checking";
let landingScrollTop = 0;
let seriesScrollTop = 0;
let searchScrollTop = 0;
let searchWasActive = false;

function getWorkspace() {
  return document.querySelector(".workspace");
}

function getCatalogModels() {
  const series = modelData.series.map((entry) => ({
    ...entry,
    models: entry.models
      .map((model) => ({
        ...model,
        variants: model.variants.filter((variant) =>
          availableModelSet.has(variant),
        ),
      }))
      .filter((model) => model.variants.length > 0),
  }));
  const otherModels = modelData.other.models
    .map((model) => ({
      ...model,
      variants: model.variants.filter((variant) =>
        availableModelSet.has(variant),
      ),
    }))
    .filter((model) => model.variants.length > 0);
  const documentedVariants = new Set(
    [...series.flatMap(({ models }) => models), ...otherModels].flatMap(
      ({ variants }) => variants,
    ),
  );

  for (const modelId of availableModels) {
    if (documentedVariants.has(modelId)) continue;
    otherModels.push({
      id: `uncatalogued-${modelId}`,
      name: modelId,
      creator: "Not documented",
      description:
        "This model is available in WebLLM but does not yet have catalog metadata.",
      parameterCount:
        modelId.match(/(?:^|-)(\d+(?:\.\d+)?[BM])(?:-|$)/i)?.[1] ??
        "Not specified",
      task: "unknown",
      modelCardUrl: availableModelCardUrls.get(modelId) ?? null,
      variants: [modelId],
    });
  }

  return {
    series,
    other: {
      ...modelData.other,
      models: otherModels,
    },
  };
}

const catalog = getCatalogModels();
const allModelGroups = [
  ...catalog.series.map((series) => ({
    ...series,
    groupId: series.id,
    groupName: series.name,
  })),
  {
    ...catalog.other,
    groupId: catalog.other.id,
    groupName: catalog.other.name,
  },
];

for (const group of allModelGroups) {
  for (const model of group.models) {
    modelSeriesById.set(model.id, group);
    modelById.set(model.id, model);
    for (const variant of model.variants) {
      modelByVariant.set(variant, model);
    }
  }
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

function readRecentModels() {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${RECENT_MODELS_COOKIE}=`));
  if (!cookie) return [];

  try {
    const stored = JSON.parse(
      decodeURIComponent(cookie.slice(RECENT_MODELS_COOKIE.length + 1)),
    );
    if (!Array.isArray(stored)) {
      throw new TypeError("Recent model cookie must contain a list.");
    }
    return stored
      .filter(
        (entry) =>
          typeof entry.modelId === "string" &&
          typeof entry.variantId === "string" &&
          availableModelSet.has(entry.variantId),
      )
      .slice(0, MAX_RECENT_MODELS);
  } catch (error) {
    logger.warn("Could not read recently used models from the cookie:", error);
    return [];
  }
}

function saveRecentModel(model, variantId) {
  const updated = [
    { modelId: model.id, variantId, usedAt: Date.now() },
    ...recentModels.filter(
      (entry) => entry.modelId !== model.id && entry.variantId !== variantId,
    ),
  ].slice(0, MAX_RECENT_MODELS);

  recentModels.splice(0, recentModels.length, ...updated);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${RECENT_MODELS_COOKIE}=${encodeURIComponent(
    JSON.stringify(recentModels),
  )}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function isModelRecent(model) {
  return recentModels.some(
    ({ modelId, variantId }) =>
      modelId === model.id || model.variants.includes(variantId),
  );
}

function isModelCached(model) {
  return model.variants.some((variant) => cachedVariants.has(variant));
}

function isModelLoaded(model) {
  return model.variants.includes(state.loadedModel);
}

function makeBadge(label, modifier = "") {
  const badge = document.createElement("span");
  badge.className = `model-badge${modifier ? ` ${modifier}` : ""}`;
  badge.textContent = label;
  return badge;
}

function addModelBadges(container, model) {
  if (recommendedModelIds.has(model.id)) {
    container.append(makeBadge("Recommended", "recommended-badge"));
  }
  if (isModelLoaded(model)) {
    container.append(makeBadge("Currently loaded", "loaded-badge"));
  } else if (isModelCached(model)) {
    container.append(makeBadge("Already downloaded", "cached-badge"));
  } else if (cacheCheckStatus === "checking") {
    container.append(makeBadge("Checking downloads", "checking-badge"));
  }
  if (isModelRecent(model)) {
    container.append(makeBadge("Recently used", "recent-badge"));
  }
}

function makeExternalLink(url, label, className = "model-card-link") {
  if (!url) return null;
  const link = document.createElement("a");
  link.className = className;
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const icon = document.createElement("img");
  icon.src = "/link.svg";
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  link.append(icon, document.createTextNode(label));
  return link;
}

function makeModelCard(model, { returnPage = "landing" } = {}) {
  const card = document.createElement("article");
  card.className = "model-choice-card";
  if (isModelLoaded(model)) card.classList.add("loaded-model-card");

  const selectButton = document.createElement("button");
  selectButton.className = "model-card-select";
  selectButton.type = "button";
  selectButton.disabled = state.isDownloading;

  const main = document.createElement("span");
  main.className = "model-card-main";
  const group = modelSeriesById.get(model.id);
  if (group?.icon) {
    const icon = document.createElement("img");
    icon.className = "model-card-icon";
    icon.src = group.icon;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    main.append(icon);
  }

  const info = document.createElement("span");
  info.className = "model-card-info";
  const heading = document.createElement("span");
  heading.className = "model-card-title";
  heading.textContent = model.name;
  const metadata = document.createElement("span");
  metadata.className = "model-card-metadata";
  metadata.textContent = `${model.creator ? `${model.creator} · ` : ""}${model.parameterCount} parameters · ${getTaskLabel(model.task)}`;
  const badges = document.createElement("span");
  badges.className = "model-badges";
  addModelBadges(badges, model);
  info.append(heading, metadata);
  main.append(info);
  selectButton.append(main);
  if (badges.childElementCount) selectButton.append(badges);
  selectButton.addEventListener("click", () =>
    showModelDetails(model, returnPage),
  );
  card.append(selectButton);

  const link = makeExternalLink(model.modelCardUrl, "Model card");
  if (link) card.append(link);
  return card;
}

function makeSeriesCard(series, query) {
  const card = document.createElement("article");
  card.className = "series-choice-card";

  const selectButton = document.createElement("button");
  selectButton.className = "series-card-select";
  selectButton.type = "button";
  selectButton.disabled = state.isDownloading;
  selectButton.setAttribute("aria-label", `Browse ${series.name} models`);

  const main = document.createElement("span");
  main.className = "series-card-main";
  if (series.icon) {
    const icon = document.createElement("img");
    icon.className = "series-card-icon";
    icon.src = series.icon;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    main.append(icon);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "series-card-icon series-icon-placeholder";
    placeholder.textContent = series.name.slice(0, 1);
    placeholder.setAttribute("aria-hidden", "true");
    main.append(placeholder);
  }

  const content = document.createElement("span");
  content.className = "series-card-content";
  const title = document.createElement("span");
  title.className = "series-card-title";
  title.textContent = series.name;
  const creator = document.createElement("span");
  creator.className = "series-card-creator";
  creator.textContent = series.creator ?? `${series.models.length} models`;
  const action = document.createElement("span");
  action.className = "series-card-action";
  action.textContent = "Browse models";
  content.append(title, creator);
  main.append(content);

  const status = document.createElement("span");
  status.className = "series-card-status";
  const cachedCount = series.models.filter(isModelCached).length;
  const recentCount = series.models.filter(isModelRecent).length;
  if (cachedCount) {
    status.append(makeBadge(`${cachedCount} downloaded`, "cached-badge"));
  } else if (cacheCheckStatus === "checking") {
    status.append(makeBadge("Checking downloads", "checking-badge"));
  }
  if (recentCount) {
    status.append(makeBadge(`${recentCount} recently used`, "recent-badge"));
  }
  content.append(action);
  selectButton.append(main);

  const summary = document.createElement("p");
  summary.className = "series-card-description";
  summary.textContent = series.description;
  selectButton.append(summary);

  const matchingModels = query
    ? series.models.filter((model) => matchesSearch(model, query))
    : [];
  if (matchingModels.length) {
    const matches = document.createElement("p");
    matches.className = "series-card-matches";
    const label = document.createElement("strong");
    label.textContent = "Matching models: ";
    matches.append(
      label,
      document.createTextNode(
        matchingModels.map(({ name }) => name).join(", "),
      ),
    );
    selectButton.append(matches);
  }

  if (status.childElementCount) selectButton.append(status);
  selectButton.addEventListener("click", () => showSeries(series));
  card.append(selectButton);
  const link = makeExternalLink(series.modelCardUrl, "Model family");
  if (link) card.append(link);
  return card;
}

function getTaskLabel(task) {
  const taskLabels = {
    chat: "Chat",
    code: "Code",
    embedding: "Embeddings",
    math: "Math",
    reasoning: "Reasoning",
    text: "Text generation",
    vision: "Vision",
  };
  return taskLabels[task] ?? "Other";
}

function renderLanding() {
  const recommendedContainer = document.getElementById("recommended-models");
  const personalModelsSection = document.getElementById(
    "personal-models-section",
  );
  const personalModelsContainer = document.getElementById("personal-models");
  const seriesContainer = document.getElementById("model-series-list");
  const filter = document
    .getElementById("model-search")
    .value.trim()
    .toLowerCase();
  recommendedContainer.replaceChildren();
  personalModelsContainer.replaceChildren();
  seriesContainer.replaceChildren();

  const recommendedModels = modelData.recommended_models
    .map((id) => modelById.get(id))
    .filter(Boolean);
  for (const model of recommendedModels) {
    recommendedContainer.append(makeModelCard(model));
  }

  const personalModelIds = new Set([
    ...recentModels.map(({ modelId }) => modelId),
    ...[...cachedVariants].map((variant) => modelByVariant.get(variant)?.id),
  ]);
  const personalModels = [...personalModelIds]
    .map((id) => modelById.get(id))
    .filter(Boolean);
  for (const model of personalModels) {
    personalModelsContainer.append(makeModelCard(model));
  }
  personalModelsSection.classList.toggle("hidden", personalModels.length === 0);

  const series = [
    ...catalog.series,
    {
      ...catalog.other,
      creator: null,
    },
  ].filter((entry) => matchesSearch(entry, filter));
  for (const entry of series) {
    seriesContainer.append(makeSeriesCard(entry, filter));
  }

  if (!series.length) {
    seriesContainer.append(
      makeEmptyMessage("No series or models match this search."),
    );
  }
}

function matchesSearch(entry, query) {
  if (!query) return true;
  const content = [
    entry.name,
    entry.creator,
    entry.description,
    ...(entry.models ?? []).flatMap((model) => [
      model.name,
      model.creator,
      model.description,
      model.parameterCount,
      ...model.variants,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return content.includes(query);
}

function makeEmptyMessage(message) {
  const element = document.createElement("p");
  element.className = "setup-empty-message";
  element.textContent = message;
  return element;
}

function showPage(pageId) {
  for (const id of ["setup-landing", "series-models", "model-details"]) {
    document.getElementById(id).classList.toggle("hidden", id !== pageId);
  }
  const currentStep = {
    "setup-landing": 1,
    "series-models": 2,
    "model-details": 3,
  }[pageId];
  document.querySelectorAll("[data-setup-step]").forEach((step) => {
    const stepNumber = Number(step.dataset.setupStep);
    step.classList.toggle("complete", stepNumber < currentStep);
    step.classList.toggle("active", stepNumber === currentStep);
    if (stepNumber === currentStep) {
      step.setAttribute("aria-current", "step");
    } else {
      step.removeAttribute("aria-current");
    }
  });
  document.getElementById("setup-stage-instruction").textContent = {
    "setup-landing": "Choose a model family, or search for a model by name.",
    "series-models":
      "Choose a model variant. For the best experience, choose a model with 8B parameters or fewer.",
    "model-details": "Choose a model format, then download it to this browser.",
  }[pageId];
}

function showSeries(series, preserveScroll = false) {
  const workspace = getWorkspace();
  if (
    !preserveScroll &&
    !document.getElementById("setup-landing").classList.contains("hidden")
  ) {
    landingScrollTop = workspace.scrollTop;
  }
  currentSeriesId = series.id;
  const heading = document.getElementById("series-detail-heading");
  heading.replaceChildren();

  const title = document.createElement("h3");
  title.textContent = series.name;
  const creator = document.createElement("p");
  creator.className = "series-detail-creator";
  creator.textContent = series.creator
    ? `Created by ${series.creator}`
    : `${series.models.length} standalone or other models`;
  const description = document.createElement("p");
  description.className = "series-detail-description";
  description.textContent = series.description;
  const text = document.createElement("div");
  text.append(title, creator, description);
  if (series.icon) {
    const icon = document.createElement("img");
    icon.className = "series-detail-icon";
    icon.src = series.icon;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    heading.append(icon);
  }
  heading.append(text);

  const link = makeExternalLink(series.modelCardUrl, "Explore model family");
  if (link) heading.append(link);

  const modelList = document.getElementById("series-model-list");
  modelList.replaceChildren();
  const models = series.models.filter((model) => matchesSearch(model, ""));
  for (const model of models) {
    modelList.append(makeModelCard(model, { returnPage: "series" }));
  }
  if (!models.length) {
    modelList.append(
      makeEmptyMessage("No models are available in this family."),
    );
  }

  showPage("series-models");
  if (preserveScroll) {
    requestAnimationFrame(() => {
      workspace.scrollTop = seriesScrollTop;
    });
  } else {
    workspace.scrollTop = 0;
  }
}

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

function isVariantRecent(variantId) {
  return recentModels.some((entry) => entry.variantId === variantId);
}

function showModelDetails(model, returnPage, preserveScroll = false) {
  const workspace = getWorkspace();
  const previousScrollTop = workspace.scrollTop;
  if (!preserveScroll) {
    if (returnPage === "series") {
      seriesScrollTop = workspace.scrollTop;
    } else {
      landingScrollTop = workspace.scrollTop;
    }
  }
  currentModel = model;
  modelDetailsReturnPage = returnPage;
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
  header.append(titleBlock);
  if (badges.childElementCount) header.append(badges);
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
    }
    if (isVariantRecent(variant)) tags.push("Recently used");
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

function setSetupControlsDisabled(disabled) {
  document
    .querySelectorAll(
      "#setup-view button, #setup-view input, #setup-view select",
    )
    .forEach((control) => {
      control.disabled = disabled;
    });
}

async function updateCachedVariants() {
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

  cacheCheckStatus = errors.length ? "partial" : "complete";
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

function refreshModelChoiceViews() {
  renderLanding();
  if (currentSeriesId) {
    const series = allModelGroups.find((entry) => entry.id === currentSeriesId);
    if (series) {
      const currentPage = document.getElementById("series-models");
      if (!currentPage.classList.contains("hidden")) showSeries(series, true);
    }
  }
  if (currentModel) {
    const detailsPage = document.getElementById("model-details");
    if (!detailsPage.classList.contains("hidden")) {
      const selectedVariant = document.getElementById("model-selection").value;
      if (currentModel.variants.includes(selectedVariant)) {
        state.selectedModel = selectedVariant;
      }
      showModelDetails(currentModel, modelDetailsReturnPage, true);
      const select = document.getElementById("model-selection");
      if (currentModel.variants.includes(selectedVariant)) {
        select.value = selectedVariant;
        state.selectedModel = selectedVariant;
      }
      updateDownloadButtonState();
    }
  }
}

export function initModelSetup() {
  const modelSearch = document.getElementById("model-search");
  const modelSelect = document.getElementById("model-selection");

  renderLanding();
  updateDownloadButtonState();

  modelSearch.addEventListener("input", () => {
    const query = modelSearch.value.trim();
    const workspace = getWorkspace();
    if (query && !searchWasActive) {
      searchScrollTop = workspace.scrollTop;
      searchWasActive = true;
    }

    renderLanding();
    if (!query && searchWasActive) {
      searchWasActive = false;
      requestAnimationFrame(() => {
        workspace.scrollTop = searchScrollTop;
      });
    }
  });
  modelSelect.addEventListener("change", (event) => {
    state.selectedModel = event.target.value;
    updateDownloadButtonState();
  });

  document.getElementById("back-to-setup").addEventListener("click", () => {
    showPage("setup-landing");
    getWorkspace().scrollTop = landingScrollTop;
  });
  document.getElementById("back-to-models").addEventListener("click", () => {
    if (modelDetailsReturnPage === "series" && currentSeriesId) {
      const series = allModelGroups.find(
        (entry) => entry.id === currentSeriesId,
      );
      if (series) {
        showSeries(series, true);
        return;
      }
    }
    showPage("setup-landing");
    getWorkspace().scrollTop = landingScrollTop;
  });

  document.getElementById("download").addEventListener("click", () => {
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
  });

  logger.debug(
    "Model setup initialized. Available models:",
    availableModels.length,
  );
  updateCachedVariants();
}
