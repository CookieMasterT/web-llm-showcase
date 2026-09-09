import { state, messages } from "../state/appState.js";
import { DEFAULT_SYSTEM_PROMPT } from "../config/constants.js";
import { logger } from "../utils/logger.js";
import { engine } from "../services/webllmEngine.js";

export function initControls() {
  // Bind Pause control
  document.getElementById("pause-btn").addEventListener("click", function () {
    state.isPaused = !state.isPaused;
    this.textContent = state.isPaused ? "RESUME" : "PAUSE";
    logger.debug("Pause toggled. isPaused:", state.isPaused);
    if (state.isPaused) {
      this.classList.add("paused");
    } else {
      this.classList.remove("paused");
    }
  });

  // Bind Stop control
  document.getElementById("stop-btn").addEventListener("click", function () {
    if (!state.isInferring) {
      return;
    }
    logger.debug(
      "Stop requested. Setting isStopped = true and signaling engine interruption.",
    );
    state.isStopped = true;
    state.isPaused = false;
    engine.interruptGenerate();
    this.textContent = "STOPPING...";
    this.disabled = true;

    const pauseBtn = document.getElementById("pause-btn");
    pauseBtn.textContent = "PAUSE";
    pauseBtn.classList.remove("paused");
  });

  // Bind Reset control
  document.getElementById("reset-btn").addEventListener("click", function () {
    logger.debug("Reset triggered. Clearing messages and UI.");
    state.isStopped = true;
    state.isPaused = false;
    engine.interruptGenerate();

    const pauseBtn = document.getElementById("pause-btn");
    pauseBtn.textContent = "PAUSE";
    pauseBtn.classList.remove("paused");

    const stopBtn = document.getElementById("stop-btn");
    stopBtn.textContent = "STOP";
    stopBtn.disabled = true;

    // Inject system prompt into chat box.
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = `<div class="system-prompt-box">System Prompt: ${DEFAULT_SYSTEM_PROMPT}</div>`;

    // Reset messages
    messages.length = 0;
    messages.push({
      content: DEFAULT_SYSTEM_PROMPT,
      role: "system",
    });

    // Reset diagnostics UI
    document.getElementById("chosen-tokens-display").innerHTML =
      "As text is generated here, new tokens appear...";
    document.getElementById("probabilities-chart").innerHTML = "";
    document.getElementById("user-input").value = "";
    document
      .getElementById("user-input")
      .setAttribute("placeholder", "Send a message...");
    document.getElementById("send").disabled = false;
  });
}
