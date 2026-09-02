import { state, messages } from "../state/appState.js";
import { DEFAULT_SYSTEM_PROMPT } from "../config/constants.js";

export function initControls() {
  // Bind Pause control
  document.getElementById("pause-btn").addEventListener("click", function () {
    state.isPaused = !state.isPaused;
    this.textContent = state.isPaused ? "RESUME" : "PAUSE";
    if (state.isPaused) {
      this.classList.add("paused");
    } else {
      this.classList.remove("paused");
    }
  });

  // Bind Stop control
  document.getElementById("stop-btn").addEventListener("click", function () {
    // This is nonsense, see issues #7 and #8
    state.isStopped = true;
    state.isPaused = false;
    this.textContent = "STOPPING...";
    this.disabled = true;

    const pauseBtn = document.getElementById("pause-btn");
    pauseBtn.textContent = "PAUSE";
    pauseBtn.classList.remove("paused");
  });

  // Bind Reset control
  document.getElementById("reset-btn").addEventListener("click", function () {
    state.isStopped = true;
    state.isPaused = false;

    const pauseBtn = document.getElementById("pause-btn");
    pauseBtn.textContent = "PAUSE";
    pauseBtn.classList.remove("paused");

    const stopBtn = document.getElementById("stop-btn");
    stopBtn.textContent = "STOP";
    stopBtn.disabled = false;

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
