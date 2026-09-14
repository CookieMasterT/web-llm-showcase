import { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL } from "../config/constants.js";

export const messages = [
  {
    content: DEFAULT_SYSTEM_PROMPT,
    role: "system",
  },
];

export const state = {
  selectedModel: DEFAULT_MODEL,
  loadedModel: null, // the currently loaded/running model, or null if none loaded
  isDownloading: false, // if a model is currently downloading/initializing
  isPaused: false, // if the model should pause due to the user hitting "PAUSE".
  isStopped: false, // if the model is stopping due to the user hitting "STOP", notably reset before each query.
  isInferring: false, // if the model is currently generating
  completion: null, // the current completion object
};
