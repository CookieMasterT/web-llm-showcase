import { calculateProbabilities } from "../utils/probabilityMath.js";
import { logger } from "../utils/logger.js";

// Update probabilities chart UI
export function updateProbabilitiesChart(
  topLogprobs,
  chosenTokenText,
  chosenTokenLogprob,
) {
  const chart = document.getElementById("probabilities-chart");
  chart.innerHTML = "";

  const temp = parseFloat(document.getElementById("temp-input").value);
  const top_p = parseFloat(document.getElementById("topp-input").value);
  const finalTemp = isNaN(temp) ? 1.0 : temp;
  const finalTopP = isNaN(top_p) ? 1.0 : top_p;

  logger.debug(
    "Updating probabilities chart — temperature:",
    finalTemp,
    "| top_p:",
    finalTopP,
    "| chosen Token:",
    chosenTokenText,
    "| candidates:",
    topLogprobs,
  );

  const candidates = [...topLogprobs];
  if (
    chosenTokenLogprob &&
    !candidates.some((item) => item.token === chosenTokenLogprob.token)
  ) {
    candidates.push(chosenTokenLogprob);
  }

  const { withRawChance, pickChances } = calculateProbabilities(
    candidates,
    finalTemp,
    finalTopP,
  );

  // Render Row Elements
  withRawChance.forEach((item) => {
    const rawPercent = item.rawChance.toFixed(1) + "%";

    const pickItem = pickChances.find((x) => x.token === item.token);
    const pickPercent = pickItem ? pickItem.chance.toFixed(1) + "%" : "0.0%";

    const row = document.createElement("div");
    row.classList.add("prob-row");

    if (chosenTokenText && item.token === chosenTokenText) {
      row.classList.add("chosen-highlight");
    }

    const tokenLabel = document.createElement("div");
    tokenLabel.classList.add("prob-tok");
    tokenLabel.textContent = item.token;

    const barContainer = document.createElement("div");
    barContainer.classList.add("prob-bar-container");

    const barOuter = document.createElement("div");
    barOuter.classList.add("prob-bar-outer");

    const barInner = document.createElement("div");
    barInner.classList.add("prob-bar-inner");
    barInner.style.width = rawPercent;

    barOuter.appendChild(barInner);
    barContainer.appendChild(barOuter);

    const rawChanceVal = document.createElement("div");
    rawChanceVal.classList.add("prob-chance");
    rawChanceVal.textContent = rawPercent;

    const pickChanceVal = document.createElement("div");
    pickChanceVal.classList.add("prob-chance");
    pickChanceVal.textContent = pickPercent;

    row.appendChild(tokenLabel);
    row.appendChild(barContainer);
    row.appendChild(rawChanceVal);
    row.appendChild(pickChanceVal);
    chart.appendChild(row);
  });
}

export function appendChosenTokenVisual(tokenText, isSpecialToken = false) {
  const display = document.getElementById("chosen-tokens-display");
  if (display.textContent.includes("As text is generated here")) {
    display.innerHTML = "";
  }
  const span = document.createElement("span");
  span.classList.add("chosen-token-span");
  if (isSpecialToken) {
    span.classList.add("end-token");
  }
  span.textContent = tokenText;
  display.appendChild(span);
  display.scrollTop = display.scrollHeight;
}

export function resetModelEndTokenHighlight() {
  const list = document.querySelector(".special-tokens-list");
  list.querySelectorAll(".model-end-token").forEach((item) => {
    item.classList.remove("model-end-token");
  });
  list.querySelectorAll("[data-dynamic-end-token]").forEach((item) => {
    item.remove();
  });
}

export function highlightModelEndToken(tokenText) {
  if (!tokenText) {
    return;
  }

  const list = document.querySelector(".special-tokens-list");
  let item = Array.from(list.querySelectorAll(".tok-name"))
    .find((token) => token.textContent === tokenText)
    ?.closest("li");

  if (!item) {
    item = document.createElement("li");
    item.dataset.dynamicEndToken = "true";

    const tokenLabel = document.createElement("span");
    tokenLabel.classList.add("tok-name");
    tokenLabel.textContent = tokenText;

    const infoIcon = document.createElement("span");
    infoIcon.classList.add("info-icon");
    infoIcon.title = "End token emitted by the current model.";
    infoIcon.textContent = "ⓘ";

    item.append(tokenLabel, infoIcon);
    list.appendChild(item);
  }

  item.classList.add("model-end-token");
}
