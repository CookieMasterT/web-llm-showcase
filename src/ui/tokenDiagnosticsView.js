import { calculateProbabilities } from "../utils/probabilityMath.js";
import { logger } from "../utils/logger.js";

// Update probabilities chart UI
export function updateProbabilitiesChart(topLogprobs, chosenTokenText) {
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
    "| candidates:",
    topLogprobs.length,
  );

  const { withRawChance, pickChances } = calculateProbabilities(
    topLogprobs,
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

    const isChosen =
      chosenTokenText &&
      (item.token === chosenTokenText ||
        item.token.replace(/[^a-zA-Z0-9]/g, "") ===
          chosenTokenText.replace(/[^a-zA-Z0-9]/g, ""));
    if (isChosen) {
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

export function appendChosenTokenVisual(tokenText) {
  const display = document.getElementById("chosen-tokens-display");
  if (display.textContent.includes("As text is generated here")) {
    display.innerHTML = "";
  }
  const span = document.createElement("span");
  span.classList.add("chosen-token-span");
  span.textContent = tokenText;
  display.appendChild(span);
  display.scrollTop = display.scrollHeight;
}
