import { state } from "../../state/appState.js";
import modelData from "../../models/model_data.json";
import {
  catalog,
  cachedVariants,
  getRecentModels,
  isModelCached,
  isModelRecent,
  makeBadge,
  makeEmptyMessage,
  makeExternalLink,
  makeModelCard,
  matchesSearch,
  modelById,
  modelByVariant,
  setupCacheState,
  setupViewState,
} from "./shared.js";

export function renderLanding(onSelectModel, onSelectSeries) {
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
    recommendedContainer.append(
      makeModelCard(model, { onSelect: onSelectModel }),
    );
  }

  const recentModels = getRecentModels();
  const personalModelIds = new Set([
    ...recentModels.map(({ modelId }) => modelId),
    ...[...cachedVariants].map((variant) => modelByVariant.get(variant)?.id),
  ]);
  const personalModels = [...personalModelIds]
    .map((id) => modelById.get(id))
    .filter(Boolean);
  for (const model of personalModels) {
    personalModelsContainer.append(
      makeModelCard(model, { onSelect: onSelectModel }),
    );
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
    seriesContainer.append(makeSeriesCard(entry, filter, onSelectSeries));
  }

  if (!series.length) {
    seriesContainer.append(
      makeEmptyMessage("No series or models match this search."),
    );
  }
}

function makeSeriesCard(series, query, onSelectSeries) {
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
  } else if (setupCacheState.status === "checking") {
    status.append(makeBadge("Checking downloads", "checking-badge"));
  }
  if (recentCount) {
    status.append(makeBadge(`${recentCount} recently used`, "recent-badge"));
  }
  content.append(action);
  selectButton.append(main);

  const summary = document.createElement("p");
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
  selectButton.addEventListener("click", () => onSelectSeries(series));
  card.append(selectButton);
  const link = makeExternalLink(series.modelCardUrl, "Model family");
  if (link) selectButton.append(link);
  return card;
}

export function initSeriesStep(onSelectModel, onSelectSeries) {
  const modelSearch = document.getElementById("model-search");
  renderLanding(onSelectModel, onSelectSeries);

  modelSearch.addEventListener("input", () => {
    const query = modelSearch.value.trim();
    const workspace = document.querySelector(".workspace");
    if (query && !setupViewState.searchWasActive) {
      setupViewState.searchScrollTop = workspace.scrollTop;
      setupViewState.searchWasActive = true;
    }

    renderLanding(onSelectModel, onSelectSeries);
    if (!query && setupViewState.searchWasActive) {
      setupViewState.searchWasActive = false;
      requestAnimationFrame(() => {
        workspace.scrollTop = setupViewState.searchScrollTop;
      });
    }
  });
}
