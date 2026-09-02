import { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL } from "../config/constants.js";

export const messages = [
  {
    content: DEFAULT_SYSTEM_PROMPT,
    role: "system",
  },
];

export const state = {
  selectedModel: DEFAULT_MODEL,
  isPaused: false,
  isStopped: false,
};
