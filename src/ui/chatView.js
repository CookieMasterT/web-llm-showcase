import { messages } from "../state/appState.js";
import { streamingGenerating } from "../services/chatService.js";
import { logger } from "../utils/logger.js";
import { reportError } from "../utils/errorHandler.js";
import { formatAssistantMessage } from "../utils/markdownFormatter.js";
import { resetSpecialTokens } from "./tokenDiagnosticsView.js";

export function appendMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const container = document.createElement("div");
  container.classList.add("message-container");
  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  renderMessageContent(newMessage, message.content, message.role);

  if (message.role === "user") {
    container.classList.add("user");
  } else {
    container.classList.add("assistant");
  }

  container.appendChild(newMessage);
  chatBox.appendChild(container);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeLastMessage() {
  const messageDoms = document
    .getElementById("chat-box")
    .querySelectorAll(".message");
  if (messageDoms.length > 0) {
    messageDoms[messageDoms.length - 1].parentElement.remove();
  }
}

function appendStatusMessage(content) {
  const chatBox = document.getElementById("chat-box");
  const status = document.createElement("div");
  status.classList.add("chat-status-message");
  status.setAttribute("role", "status");
  status.textContent = content;
  chatBox.appendChild(status);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function renderMessageContent(element, content, role) {
  if (role === "assistant") {
    element.innerHTML = formatAssistantMessage(content);
    return;
  }

  element.textContent = content;
}

export function updateLastMessage(content) {
  const messageDoms = document
    .getElementById("chat-box")
    .querySelectorAll(".message");
  if (messageDoms.length > 0) {
    const lastMessageDom = messageDoms[messageDoms.length - 1];
    const role = lastMessageDom.parentElement.classList.contains("assistant")
      ? "assistant"
      : "user";
    renderMessageContent(lastMessageDom, content, role);
  }
}

export function onMessageSend() {
  const input = document.getElementById("user-input").value.trim();
  const message = {
    content: input,
    role: "user",
  };
  if (input.length === 0) {
    return;
  }
  logger.debug(
    "User message sent:",
    input.substring(0, 80) + (input.length > 80 ? "..." : ""),
  );
  document.getElementById("send").disabled = true;

  messages.push(message);
  appendMessage(message);

  const userInput = document.getElementById("user-input");
  userInput.value = "";
  userInput.setAttribute("placeholder", "Generating...");

  const aiMessage = {
    content: "Generating...",
    role: "assistant",
  };
  appendMessage(aiMessage);

  // Reset Chosen Tokens box visual
  document.getElementById("chosen-tokens-display").innerHTML = "";
  resetSpecialTokens();

  const onFinishGenerating = (finalMessage, wasStopped) => {
    logger.debug("AI response finished. Message length:", finalMessage.length);
    if (wasStopped) {
      if (finalMessage.length > 0) {
        updateLastMessage(finalMessage);
      } else {
        removeLastMessage();
      }
      appendStatusMessage("Chat response was stopped early.");
    } else {
      updateLastMessage(finalMessage);
    }
    document.getElementById("send").disabled = false;
    userInput.setAttribute("placeholder", "Type a message...");
  };

  streamingGenerating(
    messages,
    updateLastMessage,
    onFinishGenerating,
    (err) => {
      logger.error("Chat generation error:", err);
      updateLastMessage("Generation failed. See the error message above.");
      reportError(err, "Chat generation failed");
      userInput.setAttribute("placeholder", "Type a message...");
    },
  );
}

export function initChatView() {
  document.getElementById("send").addEventListener("click", function () {
    onMessageSend();
  });
}
