import { engine } from "./webllmEngine.js";
import { state } from "../state/appState.js";
import {
  appendChosenTokenVisual,
  highlightModelEndToken,
  resetModelEndTokenHighlight,
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
    let lastSampledToken;
    resetModelEndTokenHighlight();

    const tempInput = document.getElementById("temp-input");
    const toppInput = document.getElementById("topp-input");
    const temperature = parseFloat(tempInput.value);
    const top_p = parseFloat(toppInput.value);
    logger.debug(
      "Starting generation — messages:",
      messages.length,
      "| temperature:",
      isNaN(temperature) ? 1.0 : temperature,
      "| top_p:",
      isNaN(top_p) ? 1.0 : top_p,
    );

    state.isStopped = false;
    state.isInferring = true;

    // Disable inference controls and reenable stop button.
    if (tempInput) {
      tempInput.disabled = true;
    }
    if (toppInput) {
      toppInput.disabled = true;
    }
    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.textContent = "STOP";
    }

    state.completion = await engine.chat.completions.create({
      stream: true,
      messages,
      logprobs: true,
      top_logprobs: 10,
      temperature: isNaN(temperature) ? 1.0 : temperature,
      top_p: isNaN(top_p) ? 1.0 : top_p,
    });

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

      // Check if the model stopped using its configured stop condition.
      const isNaturallyStopped = chunk.choices[0].finish_reason === "stop";

      // Apply speed delay (slider value represents delay in ms)
      const speedDelay =
        1000 - parseInt(document.getElementById("speed-slider").value);
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
      const logprobsObj = chunk.choices[0].logprobs;
      const selectedTokenLogprob = logprobsObj?.content?.[0];
      if (selectedTokenLogprob) {
        lastSampledToken = selectedTokenLogprob.token;
      }

      if (curDelta) {
        curMessage += curDelta;
        appendChosenTokenVisual(curDelta);
      }
      onUpdate(curMessage);

      // The final stop chunk does not include logprobs, so use the sampled token
      // from the preceding generation chunk.
      if (isNaturallyStopped) {
        if (lastSampledToken) {
          appendChosenTokenVisual(lastSampledToken, true);
          highlightModelEndToken(lastSampledToken);
        } else {
          logger.warn(
            "Generation stopped without a sampled token in logprobs.",
          );
        }
      }

      // Display probabilities
      if (
        logprobsObj &&
        logprobsObj.content &&
        logprobsObj.content.length > 0
      ) {
        const topLogprobs = logprobsObj.content[0].top_logprobs;
        if (topLogprobs) {
          updateProbabilitiesChart(
            topLogprobs,
            selectedTokenLogprob?.token || curDelta,
            selectedTokenLogprob,
          );
        }
      }
    }

    let finalMessage = "";
    if (state.isStopped) {
      logger.debug("Generation finished after stop interruption.");
      if (curMessage.length === 0) {
        finalMessage =
          "[Generation was stopped, before the model produced a response]";
      }
    } else {
      finalMessage = await engine.getMessage();
    }

    onFinish(finalMessage);
  } catch (err) {
    logger.error("Generation error:", err);
    onError(err);
  } finally {
    // Reset UI states when finished/stopped/errored
    state.completion = null;
    state.isInferring = false;
    const tempInput = document.getElementById("temp-input");
    const toppInput = document.getElementById("topp-input");
    if (tempInput) {
      tempInput.disabled = false;
    }
    if (toppInput) {
      toppInput.disabled = false;
    }
    if (stopBtn) {
      stopBtn.textContent = "STOP";
      stopBtn.disabled = true;
    }
    document.getElementById("send").disabled = false;
  }
}
