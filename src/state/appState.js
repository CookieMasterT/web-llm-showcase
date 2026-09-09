import { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL } from "../config/constants.js";

export const messages = [
  {
    content: DEFAULT_SYSTEM_PROMPT,
    role: "system",
  },
];

export const state = {
  selectedModel: DEFAULT_MODEL,
  isPaused: false, // if the model should pause due to the user hitting "PAUSE".
  isStopped: false, // if the model is stopping due to the user hitting "STOP", notably reset before each query.
  isInferring: false, // if the model is currently generating
  completion: null, // the current completion object
};
