import {
  getWorkspace,
  makeEmptyMessage,
  makeExternalLink,
  makeModelCard,
  setupViewState,
  showPage,
} from "./shared.js";

export function showSeries(
  series,
  { preserveScroll = false, onSelectModel } = {},
) {
  const workspace = getWorkspace();
  if (
    !preserveScroll &&
    !document.getElementById("setup-landing").classList.contains("hidden")
  ) {
    setupViewState.landingScrollTop = workspace.scrollTop;
  }
  setupViewState.currentSeriesId = series.id;
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
  for (const model of series.models) {
    modelList.append(
      makeModelCard(model, {
        returnPage: "series",
        onSelect: onSelectModel,
      }),
    );
  }
  if (!series.models.length) {
    modelList.append(
      makeEmptyMessage("No models are available in this family."),
    );
  }

  showPage("series-models");
  if (preserveScroll) {
    requestAnimationFrame(() => {
      workspace.scrollTop = setupViewState.seriesScrollTop;
    });
  } else {
    workspace.scrollTop = 0;
  }
}

export function initModelStep() {
  document.getElementById("back-to-setup").addEventListener("click", () => {
    showPage("setup-landing");
    getWorkspace().scrollTop = setupViewState.landingScrollTop;
  });
}
