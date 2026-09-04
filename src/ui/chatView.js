import { messages } from "../state/appState.js";
import { streamingGenerating } from "../services/chatService.js";
import { logger } from "../utils/logger.js";

export function appendMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const container = document.createElement("div");
  container.classList.add("message-container");
  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  newMessage.textContent = message.content;

  if (message.role === "user") {
    container.classList.add("user");
  } else {
    container.classList.add("assistant");
  }

  container.appendChild(newMessage);
  chatBox.appendChild(container);
  chatBox.scrollTop = chatBox.scrollHeight;
}

export function updateLastMessage(content) {
  const messageDoms = document
    .getElementById("chat-box")
    .querySelectorAll(".message");
  if (messageDoms.length > 0) {
    const lastMessageDom = messageDoms[messageDoms.length - 1];
    lastMessageDom.textContent = content;
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

  document.getElementById("user-input").value = "";
  document
    .getElementById("user-input")
    .setAttribute("placeholder", "Generating...");

  const aiMessage = {
    content: "typing...",
    role: "assistant",
  };
  appendMessage(aiMessage);

  // Reset Chosen Tokens box visual
  document.getElementById("chosen-tokens-display").innerHTML = "";

  const onFinishGenerating = (finalMessage) => {
    logger.debug("AI response finished. Message length:", finalMessage.length);
    updateLastMessage(finalMessage);
    document.getElementById("send").disabled = false;
  };

  streamingGenerating(messages, updateLastMessage, onFinishGenerating, (err) =>
    logger.error("Chat generation error:", err),
  );
}

export function initChatView() {
  document.getElementById("send").addEventListener("click", function () {
    onMessageSend();
  });
}
