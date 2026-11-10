import { state } from "../../state/appState.js";
import modelData from "../../models/model_data.json";
import {
  availableModels,
  availableModelCardUrls,
} from "../../services/webllmEngine.js";
import { logger } from "../../utils/logger.js";

const RECENT_MODELS_COOKIE = "webllm-recent-models";
const MAX_RECENT_MODELS = 5;
const availableModelSet = new Set(availableModels);
const recommendedModelIds = new Set(modelData.recommended_models);
const recentModels = readRecentModels();
export const cachedVariants = new Set();
export const setupCacheState = { status: "checking" };

export const setupViewState = {
  currentSeriesId: null,
  currentModel: null,
  modelDetailsReturnPage: "landing",
  landingScrollTop: 0,
  seriesScrollTop: 0,
  searchScrollTop: 0,
  searchWasActive: false,
};

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

export const catalog = getCatalogModels();
export const allModelGroups = [
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
export const modelSeriesById = new Map();
export const modelById = new Map();
export const modelByVariant = new Map();

for (const group of allModelGroups) {
  for (const model of group.models) {
    modelSeriesById.set(model.id, group);
    modelById.set(model.id, model);
    for (const variant of model.variants) {
      modelByVariant.set(variant, model);
    }
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

export function saveRecentModel(model, variantId) {
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

export function getRecentModels() {
  return recentModels;
}

export function isModelRecent(model) {
  return recentModels.some(
    ({ modelId, variantId }) =>
      modelId === model.id || model.variants.includes(variantId),
  );
}

export function isVariantRecent(variantId) {
  return recentModels.some((entry) => entry.variantId === variantId);
}

export function isModelCached(model) {
  return model.variants.some((variant) => cachedVariants.has(variant));
}

export function isModelLoaded(model) {
  return model.variants.includes(state.loadedModel);
}

export function makeBadge(label, modifier = "") {
  const badge = document.createElement("span");
  badge.className = `model-badge${modifier ? ` ${modifier}` : ""}`;
  badge.textContent = label;
  return badge;
}

export function addModelBadges(container, model) {
  if (recommendedModelIds.has(model.id)) {
    container.append(makeBadge("Recommended", "recommended-badge"));
  }
  if (isModelLoaded(model)) {
    container.append(makeBadge("Currently loaded", "loaded-badge"));
  } else if (isModelCached(model)) {
    container.append(makeBadge("Already downloaded", "cached-badge"));
  } else if (isModelRecent(model)) {
    container.append(makeBadge("Recently used", "recent-badge"));
  }
}

export function makeExternalLink(url, label, className = "model-card-link") {
  if (!url) return null;
  const link = document.createElement("a");
  link.className = className;
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.onclick = (event) => {
    event.stopPropagation();
  };

  const icon = document.createElement("img");
  icon.src = "/link.svg";
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  link.append(icon, document.createTextNode(label));
  return link;
}

export function getTaskLabel(task) {
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

export function makeModelCard(
  model,
  { returnPage = "landing", onSelect } = {},
) {
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
  selectButton.append(main, badges);
  if (onSelect) {
    selectButton.addEventListener("click", () => onSelect(model, returnPage));
  }
  card.append(selectButton);

  const link = makeExternalLink(model.modelCardUrl, "Model card");
  if (link) selectButton.append(link);
  return card;
}

export function matchesSearch(entry, query) {
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

export function makeEmptyMessage(message) {
  const element = document.createElement("p");
  element.className = "setup-empty-message";
  element.textContent = message;
  return element;
}

export function showPage(pageId) {
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
    "series-models": "Choose a model variant.",
    "model-details": "Choose a model format, then download it to this browser.",
  }[pageId];
}

export function getWorkspace() {
  return document.querySelector(".workspace");
}
