import { calculateProbabilities } from "../utils/probabilityMath.js";
import { logger } from "../utils/logger.js";
import FORMATTING_MARKS from "./specialTokens/formattingMarks.json" with { type: "json" };
import TECHNICAL_TOKENS from "./specialTokens/technicalTokens.json" with { type: "json" };

export function formatTokenForDisplay(tokenText) {
  if (!tokenText) {
    return "∅";
  }

  let formatted = "";
  for (const character of tokenText) {
    formatted += FORMATTING_MARKS[character]?.mark ?? character;
  }
  return formatted || "∅";
}

export function isSpecialTokenText(tokenText) {
  if (!tokenText) {
    return false;
  }
  if (Object.hasOwn(TECHNICAL_TOKENS.tokens, tokenText)) {
    return true;
  }
  if (/^<\|[^>|]+\|>$/.test(tokenText)) {
    return true;
  }
  if (/^<\/?[A-Za-z][A-Za-z0-9_-]*>$/.test(tokenText)) {
    return true;
  }
  if (/^\[[/A-Za-z][^\]]*\]$/.test(tokenText)) {
    return true;
  }
  if (/^(`{3,}|~{3,})/.test(tokenText) || /^`+$/.test(tokenText)) {
    return true;
  }
  return /^(#{1,6}\s?|>\s?|[*_]{1,3}|[-=]{1,3})$/.test(tokenText);
}

function getTechnicalTokenDescription(tokenText) {
  if (Object.hasOwn(TECHNICAL_TOKENS.tokens, tokenText)) {
    return TECHNICAL_TOKENS.tokens[tokenText];
  }
  if (/^<\|[^>|]+\|>$/.test(tokenText)) {
    return "Model control token";
  }
  if (/^<\/?[A-Za-z][A-Za-z0-9_-]*>$/.test(tokenText)) {
    return "Model turn or control tag";
  }
  if (/^\[[/A-Za-z][^\]]*\]$/.test(tokenText)) {
    return "Model instruction token";
  }
  if (/^`{3,}|^~{3,}/.test(tokenText)) {
    return "Code fence";
  }
  if (/^`+$/.test(tokenText)) {
    return "Inline code delimiter";
  }
  if (/^#{1,6}\s?$/.test(tokenText)) {
    return "Markdown heading marker";
  }
  if (/^>\s?$/.test(tokenText)) {
    return "Markdown blockquote marker";
  }
  if (/^[*_]{1,3}$/.test(tokenText)) {
    return "Markdown emphasis marker";
  }
  if (/^[-=]{1,3}$/.test(tokenText)) {
    return "Markdown underline or list marker";
  }
  return "Special token";
}

export function isEndingToken(tokenText) {
  if (typeof tokenText !== "string") {
    return false;
  }
  if (TECHNICAL_TOKENS.endTokens.includes(tokenText)) {
    return true;
  }
  return (
    /^<\|[^>|]*(eot|end|eos)[^>|]*\|>$/.test(tokenText) ||
    /^(<\/s>|<eos>|\[\/INST\]|\[\/s\])$/i.test(tokenText)
  );
}

function appendFormattedTokenText(span, tokenText) {
  if (!tokenText) {
    const emptyMark = document.createElement("span");
    emptyMark.className = "formatting-mark-inline";
    emptyMark.textContent = "∅";
    span.appendChild(emptyMark);
    return;
  }

  for (const character of tokenText) {
    if (Object.hasOwn(FORMATTING_MARKS, character)) {
      const mark = document.createElement("span");
      mark.className = "formatting-mark-inline";
      mark.textContent = FORMATTING_MARKS[character].mark;
      span.appendChild(mark);
    } else {
      span.appendChild(document.createTextNode(character));
    }
  }
}

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
  if (
    display.textContent.includes("As text is generated here") ||
    display.textContent.includes("No formatting or technical tokens yet")
  ) {
    display.innerHTML = "";
  }
  const span = document.createElement("span");
  span.classList.add("chosen-token-span");
  const technicalSpecial = isSpecialToken
    ? isEndingToken(tokenText)
    : isEndingToken(tokenText);
  if (technicalSpecial) {
    span.classList.add("end-token");
  }
  appendFormattedTokenText(span, tokenText);
  span.title = tokenText
    ? `Raw token: ${JSON.stringify(tokenText)}`
    : "Empty token";
  span.dataset.rawToken = tokenText ?? "";
  span.classList.toggle("empty-token", !tokenText);
  display.appendChild(span);
  registerSpecialTokenUses(tokenText);
  updateSpecialTokenCategories();
  display.scrollTop = display.scrollHeight;
}

export function resetSpecialTokens() {
  document.querySelectorAll(".special-tokens-list").forEach((list) => {
    list.innerHTML = "";
  });
  updateSpecialTokenCategories();
}

function updateSpecialTokenCategories() {
  const formattingList = document.querySelector(".formatting-marks-list");
  const technicalList = document.querySelector(".technical-tokens-list");
  const formattingCategory = document.querySelector(
    '[data-category="formatting"]',
  );
  const technicalCategory = document.querySelector(
    '[data-category="technical"]',
  );
  const section = document.querySelector(
    ".diag-left-col .diag-section:last-child",
  );

  if (formattingCategory) {
    formattingCategory.hidden = !formattingList?.hasChildNodes();
  }
  if (technicalCategory) {
    technicalCategory.hidden = !technicalList?.hasChildNodes();
  }

  if (section) {
    let placeholder = section.querySelector(".special-tokens-placeholder");
    const isEmpty =
      !formattingList?.hasChildNodes() && !technicalList?.hasChildNodes();
    if (isEmpty) {
      if (!placeholder) {
        placeholder = document.createElement("p");
        placeholder.className = "special-tokens-placeholder";
        placeholder.textContent =
          "As text is generated here, new tokens appear...";
        section.appendChild(placeholder);
      }
    } else {
      placeholder?.remove();
    }
  }
}

export function resetModelEndTokenHighlight() {
  resetSpecialTokens();
}

function registerFormattingMark(character) {
  const mark = FORMATTING_MARKS[character];
  if (!mark) {
    return;
  }
  const list = document.querySelector(".formatting-marks-list");
  if (!list) {
    return;
  }
  if (
    Array.from(list.querySelectorAll("[data-formatting-token]")).some(
      (item) => item.dataset.formattingToken === character,
    )
  ) {
    return;
  }

  const item = document.createElement("li");
  item.dataset.formattingToken = character;
  item.classList.add("formatting-mark-token");

  const markLabel = document.createElement("span");
  markLabel.classList.add("formatting-mark");
  markLabel.textContent = mark.mark;

  const description = document.createElement("span");
  description.classList.add("formatting-description");
  description.textContent = mark.label;

  item.append(markLabel, description);
  list.appendChild(item);
}

function registerTechnicalToken(tokenText) {
  if (!tokenText) {
    return;
  }

  const list = document.querySelector(".technical-tokens-list");
  if (!list) {
    return;
  }
  let item = Array.from(list.querySelectorAll(".tok-name"))
    .find((token) => token.textContent === tokenText)
    ?.closest("li");

  if (!item) {
    item = document.createElement("li");
    item.dataset.dynamicEndToken = "true";
    item.classList.add("technical-token");

    const tokenLabel = document.createElement("span");
    tokenLabel.classList.add("tok-name");
    tokenLabel.classList.add("chosen-token-span");
    if (isEndingToken(tokenText)) {
      tokenLabel.classList.add("end-token");
    }
    appendFormattedTokenText(tokenLabel, tokenText);

    const description = document.createElement("span");
    description.classList.add("technical-description");
    description.textContent = getTechnicalTokenDescription(tokenText);

    item.append(tokenLabel, description);
    list.appendChild(item);
  }
}

function registerSpecialTokenUses(tokenText) {
  if (!tokenText) {
    return;
  }
  for (const character of tokenText) {
    if (Object.hasOwn(FORMATTING_MARKS, character)) {
      registerFormattingMark(character);
    }
  }
  if (isSpecialTokenText(tokenText)) {
    registerTechnicalToken(tokenText);
  }
}

export function highlightModelEndToken(tokenText) {
  if (!tokenText) {
    return;
  }
  if (isSpecialTokenText(tokenText)) {
    registerTechnicalToken(tokenText);
  }
}
