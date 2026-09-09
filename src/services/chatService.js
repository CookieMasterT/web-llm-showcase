import { engine } from "./webllmEngine.js";
import { state } from "../state/appState.js";
import {
  appendChosenTokenVisual,
  updateProbabilitiesChart,
} from "../ui/tokenDiagnosticsView.js";
import { logger } from "../utils/logger.js";

export async function streamingGenerating(
  messages,
  onUpdate,
  onFinish,
  onError,
) {
  const stopBtn = document.getElementById("stop-btn");
  try {
    let curMessage = "";
    const temperature = parseFloat(document.getElementById("temp-input").value);
    const top_p = parseFloat(document.getElementById("topp-input").value);

    logger.debug(
      "Starting generation — messages:",
      messages.length,
      "| temperature:",
      isNaN(temperature) ? 1.0 : temperature,
      "| top_p:",
      isNaN(top_p) ? 1.0 : top_p,
    );

    state.completion = await engine.chat.completions.create({
      stream: true,
      messages,
      logprobs: true,
      top_logprobs: 10,
      temperature: isNaN(temperature) ? 1.0 : temperature,
      top_p: isNaN(top_p) ? 1.0 : top_p,
    });

    state.isStopped = false;

    for await (const chunk of state.completion) {
      if (state.isStopped) {
        // Generation stopped: drain remaining chunk(s) without UI rendering
        // so WebLLM's generator can cleanly reach its lock release.
        continue;
      }

      // Check if paused, then wait until unpaused or stopped.
      while (state.isPaused && !state.isStopped) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (state.isStopped) {
        continue;
      }

      // Check if model stopped naturally (the model finished, beacuse it chose <|im_end|>)
      const isNaturallyStopped = chunk.choices[0].finish_reason === "stop";

      // Apply speed delay (slider value represents delay in ms)
      const speedDelay = parseInt(
        document.getElementById("speed-slider").value,
      );
      if (speedDelay > 0 && !state.isStopped && !isNaturallyStopped) {
        await new Promise((resolve) => setTimeout(resolve, speedDelay));
      }

      // Check if paused, this time after the speed delay, as to not let a token slip.
      while (state.isPaused && !state.isStopped) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (state.isStopped) {
        continue;
      }

      // append the new content to the current message and update the UI
      let curDelta = chunk.choices[0].delta.content;
      if (curDelta) {
        curMessage += curDelta;
        appendChosenTokenVisual(curDelta);
      }
      onUpdate(curMessage);

      // If model stops naturally, append the special stop token to chosen tokens visualization
      if (isNaturallyStopped) {
        curDelta = "<|im_end|>";
        appendChosenTokenVisual(curDelta);
      }

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
    }

    if (state.isStopped) {
      logger.debug("Generation finished after stop interruption.");
    }

    const finalMessage = await engine.getMessage();
    onFinish(finalMessage);
  } catch (err) {
    logger.error("Generation error:", err);
    onError(err);
  } finally {
    // Reset stop button state when finished/stopped/errored
    stopBtn.textContent = "STOP";
    stopBtn.disabled = false;
    document.getElementById("send").disabled = false;
    state.completion = null;
  }
}
