import { logger } from "./logger.js";

const UNKNOWN_ERROR_MESSAGE =
  "An unexpected error occurred. Please try again. If the problem continues, check the browser console for details.";

const KNOWN_ERRORS = [
  {
    pattern:
      /ns_error_file_no_device_space|quotaexceedederror|quota exceeded|out of storage|insufficient storage|no device space/i,
    getMessage: () => getStorageErrorMessage(),
  },
  {
    pattern:
      /webgpunotavailableerror|webgpunotfounderror|webgpu.{0,30}(not supported|unavailable|disabled)|navigator\.gpu|no gpu adapter|requestadapter.*null/i,
    message:
      "WebGPU is unavailable. Try a WebGPU supported browser and make sure hardware acceleration is enabled. For more information about WebGPU support in your browser, visit https://webgpureport.org/",
  },
  {
    pattern:
      /featuresupporterror|shaderf16supporterror|requires feature .*not yet supported|shader-f16/i,
    message:
      "This model requires a GPU feature that your browser does not support. Try a different model or a compatible browser/device. For more information about WebGPU support in your browser, visit https://webgpureport.org/",
  },
  {
    pattern:
      /device was lost|device lost|devicelosterror|context lost|buffer unmapped|mapping webgpu buffer failed/i,
    message:
      "The GPU ran out of resources or the WebGPU context was lost while running this model. Try a smaller model or try to free up computer resources, and reload the page.",
  },
  {
    pattern:
      /out of memory|insufficient memory|maxbuffersize|buffer.{0,30}(limit|too large)/i,
    message:
      "The selected model may be too large for this device. Try a smaller model or try to free up computer resources.",
  },
  {
    pattern: /failed to fetch|networkerror|network request failed|load failed/i,
    message:
      "The model could not be downloaded. Check your internet connection and try again.",
  },
];

function getBrowserName() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Firefox|FxiOS/i.test(userAgent)) return "Firefox";
  if (/CriOS|Chrome/i.test(userAgent)) return "Chrome";
  if (/Safari/i.test(userAgent)) return "Safari";
  return null;
}

function getStorageErrorMessage() {
  const hostname =
    typeof window === "undefined"
      ? "this website"
      : window.location.hostname || "this website";
  const browser = getBrowserName();
  // The instructions excluding the firefox one are LLM generated and might be incorrect
  const instructions = {
    Chrome: `In Chrome, open chrome://settings/content/all, search for "${hostname}", and delete its stored data.`,
    Edge: `In Edge, open edge://settings/content/all, search for "${hostname}", and delete its stored data.`,
    Firefox: `In Firefox, open Settings > Privacy & Security > Cookies and Site Data > Clear data for specific sites, search for "${hostname}", remove it and save changes.`,
    Safari: `In Safari, open Settings > Privacy > Manage Website Data, find "${hostname}", and remove its data. On iPhone or iPad, use Settings > Apps > Safari > Advanced > Website Data.`,
  };
  const browserInstructions =
    instructions[browser] ??
    `In your browser's privacy or site settings, find "${hostname}" and clear its stored site data.`;

  return `There isn't enough storage space to save the model. Clear this website's stored data to free space, then reload and try again. ${browserInstructions} This removes the site's cached model files, so you may need to download the model again.`;
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    const errorText = error.toString();
    if (errorText.trim()) return errorText;
  }
  if (typeof error === "string") {
    if (error.trim()) return error;
  }
  if (error && typeof error === "object") {
    const message = error.message;
    if (typeof message === "string" && message.trim()) {
      return error.name && error.name !== "Error"
        ? `${error.name}: ${message}`
        : message;
    }

    const errorText = String(error);
    if (errorText !== "[object Object]") return errorText;
  }
  try {
    const serialized = JSON.stringify(error);
    if (
      serialized &&
      serialized !== "{}" &&
      serialized !== "[]" &&
      serialized !== '""'
    ) {
      return serialized;
    }
  } catch {
    // Use the generic message for circular or otherwise unserializable values.
  }
  const fallback = String(error);
  return fallback !== "[object Object]" && fallback !== "undefined"
    ? fallback
    : UNKNOWN_ERROR_MESSAGE;
}

export function classifyError(error) {
  const rawMessage = getErrorMessage(error);
  const errorDetails = `${error?.name ?? ""} ${rawMessage}`;
  const knownError = KNOWN_ERRORS.find(({ pattern }) =>
    pattern.test(errorDetails),
  );

  return {
    message: knownError
      ? (knownError.getMessage?.() ?? knownError.message)
      : rawMessage,
    rawMessage,
    isKnown: Boolean(knownError),
  };
}

export function reportError(error, context = "Application error") {
  logger.error(`${context}:`, error);

  const notification = document.getElementById("error-notification");
  const messageElement = document.getElementById("error-message");
  const contextElement = document.getElementById("error-context");
  if (!notification || !messageElement || !contextElement) {
    logger.error("Error notification UI is unavailable.");
    return;
  }

  const classifiedError = classifyError(error);
  contextElement.textContent = context;
  messageElement.textContent = classifiedError.message;
  notification.classList.remove("hidden");
}

export function initGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, "Unexpected application error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "Unexpected asynchronous error");
  });

  document.getElementById("error-dismiss")?.addEventListener("click", () => {
    document.getElementById("error-notification")?.classList.add("hidden");
  });
}
