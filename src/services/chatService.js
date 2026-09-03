import { engine } from "./webllmEngine.js";
import { state } from "../state/appState.js";
import {
  appendChosenTokenVisual,
  updateProbabilitiesChart,
} from "../ui/tokenDiagnosticsView.js";

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

    const completion = await engine.chat.completions.create({
      stream: true,
      messages,
      logprobs: true,
      top_logprobs: 10,
      temperature: isNaN(temperature) ? 1.0 : temperature,
      top_p: isNaN(top_p) ? 1.0 : top_p,
    });

    state.isStopped = false;

    for await (const chunk of completion) {
      if (state.isStopped) {
        break;
      }

      // Check if paused, then wait until unpaused or stopped.
      while (state.isPaused && !state.isStopped) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (state.isStopped) {
        break;
      }

      // Apply speed delay (slider value represents delay in ms)
      const speedDelay = parseInt(
        document.getElementById("speed-slider").value,
      );
      if (speedDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, speedDelay));
      }

      // Check again, incase the user paused during the speed delay
      while (state.isPaused && !state.isStopped) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (state.isStopped) {
        break;
      }

      // append the new content to the current message and update the UI
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
