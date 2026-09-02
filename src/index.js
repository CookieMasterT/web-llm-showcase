import * as webllm from "../web-llm-unlocked/lib/index.js";

// #region WebLLM Logic
const messages = [
  {
    content: "You are a helpful AI agent helping users.",
    role: "system",
  },
];

const availableModels = webllm.prebuiltAppConfig.model_list.map(
  (m) => m.model_id,
);
let selectedModel = "Llama-3-8B-Instruct-q4f32_1-MLC-1k";

// Callback function for initializing progress
function updateEngineInitProgressCallback(report) {
  console.log("initialize", report.progress);
  document.getElementById("download-status").textContent = report.text;
}

// Create engine instance
const engine = new webllm.MLCEngine();
engine.setInitProgressCallback(updateEngineInitProgressCallback);

async function initializeWebLLMEngine() {
  document.getElementById("download-status").classList.remove("hidden");
  selectedModel = document.getElementById("model-selection").value;
  const config = {
    temperature: 1.0,
    top_p: 1,
  };
  await engine.reload(selectedModel, config);
}
// #endregion

// #region Navigation & State Logic
const viewNavs = ["setup", "chat", "insights"];
viewNavs.forEach((view) => {
  document.getElementById(`nav-${view}`).addEventListener("click", () => {
    // Only allow switching to Chat/Insights if disabled attribute is not present
    if (document.getElementById(`nav-${view}`).hasAttribute("disabled")) {
      return;
    }
    viewNavs.forEach((v) => {
      document.getElementById(`${v}-view`).classList.add("hidden");
      document.getElementById(`nav-${v}`).classList.remove("active");
    });
    document.getElementById(`${view}-view`).classList.remove("hidden");
    document.getElementById(`nav-${view}`).classList.add("active");
  });
});

let isPaused = false;
let isStopped = false;

// Update probabilities chart UI
function updateProbabilitiesChart(topLogprobs, chosenTokenText) {
  const chart = document.getElementById("probabilities-chart");
  chart.innerHTML = "";

  const temp = parseFloat(document.getElementById("temp-input").value);
  const top_p = parseFloat(document.getElementById("topp-input").value);
  const finalTemp = isNaN(temp) ? 1.0 : temp;
  const finalTopP = isNaN(top_p) ? 1.0 : top_p;

  // 1. Sort by raw logprob descending
  const sorted = [...topLogprobs].sort((a, b) => b.logprob - a.logprob);

  // 2. Compute Unnormalized Chance percentages
  const rawSum = sorted.reduce((acc, x) => acc + Math.exp(x.logprob), 0);
  const withRawChance = sorted.map((item) => {
    const chance = rawSum > 0 ? (Math.exp(item.logprob) / rawSum) * 100 : 0;
    return { ...item, rawChance: chance };
  });

  // 3. Compute Chance to Pick (affected by Temp & Top-P)
  let adjusted = sorted.map((item) => {
    let weight = finalTemp <= 0.05 ? 0 : Math.exp(item.logprob / finalTemp);
    return { ...item, weight };
  });
  if (finalTemp <= 0.05 && adjusted.length > 0) {
    adjusted[0].weight = 1.0;
  }

  const adjSum = adjusted.reduce((acc, x) => acc + x.weight, 0);
  adjusted.forEach((item) => {
    item.temp_prob = adjSum > 0 ? item.weight / adjSum : 0;
  });

  // Sort descending by temperature-adjusted probability
  adjusted.sort((a, b) => b.temp_prob - a.temp_prob);

  // Apply Top-P thresholding
  let cumSum = 0;
  let insideTopP = [];
  adjusted.forEach((item) => {
    if (cumSum < finalTopP) {
      insideTopP.push(item);
    }
    cumSum += item.temp_prob;
  });

  // Re-normalize top-p candidates
  const finalSum = insideTopP.reduce((acc, x) => acc + x.temp_prob, 0);
  const pickChances = adjusted.map((item) => {
    const inP = insideTopP.includes(item);
    const chance =
      inP && finalSum > 0 ? (item.temp_prob / finalSum) * 100 : 0.0;
    return { token: item.token, chance };
  });

  // 4. Render Row Elements
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

function appendChosenTokenVisual(tokenText) {
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

async function streamingGenerating(messages, onUpdate, onFinish, onError) {
  const stopBtn = document.getElementById("stop-btn");
  try {
    let curMessage = "";
    const temperature = parseFloat(document.getElementById("temp-input").value);
    const top_p = parseFloat(document.getElementById("topp-input").value);

    const completion = await engine.chat.completions.create({
      stream: true,
      messages,
      logprobs: true,
      top_logprobs: 10,
      temperature: isNaN(temperature) ? 1.0 : temperature,
      top_p: isNaN(top_p) ? 1.0 : top_p,
    });

    isStopped = false;

    for await (const chunk of completion) {
      if (isStopped) {
        break;
      }

      // Check if paused
      while (isPaused && !isStopped) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (isStopped) {
        break;
      }

      // Apply speed delay (slider value represents delay in ms)
      const speedDelay = parseInt(
        document.getElementById("speed-slider").value,
      );
      if (speedDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, speedDelay));
      }

      while (isPaused && !isStopped) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (isStopped) {
        break;
      }

      const curDelta = chunk.choices[0].delta.content;
      if (curDelta) {
        curMessage += curDelta;
        appendChosenTokenVisual(curDelta);
      }
      onUpdate(curMessage);

      // Display probabilities
      const logprobsObj = chunk.choices[0].logprobs;
      if (
        logprobsObj &&
        logprobsObj.content &&
        logprobsObj.content.length > 0
      ) {
        const topLogprobs = logprobsObj.content[0].top_logprobs;
        if (topLogprobs) {
          updateProbabilitiesChart(topLogprobs, curDelta);
        }
      }

      // If finish reason is stop, append the special stop token to chosen tokens visualization
      if (chunk.choices[0].finish_reason === "stop") {
        appendChosenTokenVisual("<|im_end|>");
      }
    }
    const finalMessage = await engine.getMessage();
    onFinish(finalMessage);
  } catch (err) {
    onError(err);
  } finally {
    // Reset stop button state when finished/stopped/errored
    stopBtn.textContent = "STOP";
    stopBtn.disabled = false;
    document.getElementById("send").disabled = false;
  }
}
// #endregion

// #region UI Logic
function onMessageSend() {
  const input = document.getElementById("user-input").value.trim();
  const message = {
    content: input,
    role: "user",
  };
  if (input.length === 0) {
    return;
  }
  document.getElementById("send").disabled = true;

  messages.push(message);
  appendMessage(message);

  document.getElementById("user-input").value = "";
  document
    .getElementById("user-input")
    .setAttribute("placeholder", "Generating...");

  const aiMessage = {
    content: "typing...",
    role: "assistant",
  };
  appendMessage(aiMessage);

  // Reset Chosen Tokens box visual
  document.getElementById("chosen-tokens-display").innerHTML = "";

  const onFinishGenerating = (finalMessage) => {
    updateLastMessage(finalMessage);
    document.getElementById("send").disabled = false;
  };

  streamingGenerating(
    messages,
    updateLastMessage,
    onFinishGenerating,
    console.error,
  );
}

function appendMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const container = document.createElement("div");
  container.classList.add("message-container");
  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  newMessage.textContent = message.content;

  if (message.role === "user") {
    container.classList.add("user");
  } else {
    container.classList.add("assistant");
  }

  container.appendChild(newMessage);
  chatBox.appendChild(container);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function updateLastMessage(content) {
  const messageDoms = document
    .getElementById("chat-box")
    .querySelectorAll(".message");
  if (messageDoms.length > 0) {
    const lastMessageDom = messageDoms[messageDoms.length - 1];
    lastMessageDom.textContent = content;
  }
}

// #endregion

// #region Model Selection Search & Initialization
function populateModels(filterQuery = "") {
  const select = document.getElementById("model-selection");
  select.innerHTML = "";
  availableModels.forEach((modelId) => {
    if (modelId.toLowerCase().includes(filterQuery.toLowerCase())) {
      const option = document.createElement("option");
      option.value = modelId;
      option.textContent = modelId;
      select.appendChild(option);
    }
  });
  if (select.options.length > 0) {
    if ([...select.options].some((opt) => opt.value === selectedModel)) {
      select.value = selectedModel;
    } else {
      select.selectedIndex = 0;
      selectedModel = select.value;
    }
  }
}

// Initial populate
populateModels();

document.getElementById("model-search").addEventListener("input", (e) => {
  populateModels(e.target.value);
});

document.getElementById("download").addEventListener("click", function () {
  const downloadBtn = this;
  downloadBtn.disabled = true;
  downloadBtn.textContent = "Downloading...";

  initializeWebLLMEngine()
    .then(() => {
      downloadBtn.textContent = "Downloaded";
      document.getElementById("send").disabled = false;

      // Enable chat & insights tabs
      const chatNav = document.getElementById("nav-chat");
      chatNav.removeAttribute("disabled");
      chatNav.removeAttribute("title");
      document.getElementById("nav-insights").removeAttribute("disabled");

      // Auto-switch to chat view
      chatNav.click();
    })
    .catch((err) => {
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download";
      console.error(err);
    });
});

document.getElementById("send").addEventListener("click", function () {
  onMessageSend();
});

// Bind Pause/Resume, Stop, Reset controls
document.getElementById("pause-btn").addEventListener("click", function () {
  isPaused = !isPaused;
  this.textContent = isPaused ? "RESUME" : "PAUSE";
  if (isPaused) {
    this.classList.add("paused");
  } else {
    this.classList.remove("paused");
  }
});

document.getElementById("stop-btn").addEventListener("click", function () {
  isStopped = true;
  isPaused = false;
  this.textContent = "STOPPING...";
  this.disabled = true;

  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.textContent = "PAUSE";
  pauseBtn.classList.remove("paused");
});

document.getElementById("reset-btn").addEventListener("click", function () {
  isStopped = true;
  isPaused = false;

  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.textContent = "PAUSE";
  pauseBtn.classList.remove("paused");

  const stopBtn = document.getElementById("stop-btn");
  stopBtn.textContent = "STOP";
  stopBtn.disabled = false;

  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML =
    '<div class="system-prompt-box">System Prompt: You are a helpful AI agent helping users.</div>';

  messages.length = 0;
  messages.push({
    content: "You are a helpful AI agent helping users.",
    role: "system",
  });

  document.getElementById("chosen-tokens-display").innerHTML =
    "As text is generated here, new tokens appear...";
  document.getElementById("probabilities-chart").innerHTML = "";
  document.getElementById("user-input").value = "";
  document
    .getElementById("user-input")
    .setAttribute("placeholder", "Send a message...");
  document.getElementById("send").disabled = false;
});

// #endregion
