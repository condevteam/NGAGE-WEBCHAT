"use client";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import "../ChatWidget.css";
import { useStomp } from "../hooks/useStomp";

const CHAT_WIDGET_ID_KEY = "CHAT_WIDGET_ID";
const CHAT_HISTORY_KEY = "NGAGE_CHAT_HISTORY";

function createWidgetId(currentWindowId) {
  if (currentWindowId) {
    localStorage.setItem(CHAT_WIDGET_ID_KEY, currentWindowId);
    return currentWindowId;
  }

  let id = localStorage.getItem(CHAT_WIDGET_ID_KEY);
  if (!id) {
    id = `visitor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem(CHAT_WIDGET_ID_KEY, id);
  }
  return id;
}

function loadStoredMessages(widgetId) {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) ?? "null");
    if (stored?.widgetId !== widgetId || !Array.isArray(stored.messages)) {
      return [];
    }

    const lastIndex = stored.messages.length - 1;

    return stored.messages.map((message, index) => {
      const hasOptions = message.renderHint?.options?.length > 0;
      const isLastMessage = index === lastIndex;

      return {
        ...message,
        // Only auto-answer option messages that AREN'T the last message.
        // The last message (if it has options) stays active.
        answered: hasOptions ? !isLastMessage : message.answered,
        restored: true,
      };
    });
  } catch {
    return [];
  }
}

function saveStoredMessages(widgetId, messages) {
  localStorage.setItem(
    CHAT_HISTORY_KEY,
    JSON.stringify({
      widgetId,
      messages: messages.map(({ restored, ...message }) => message),
    }),
  );
}

function normalizeIncoming(raw) {
  return {
    id: raw.eventId ?? `srv_${Date.now()}_${Math.random()}`,
    sender: "AGENT",
    text: raw.text ?? "",
    step: raw.step ?? null,
    renderHint: raw.renderHint ?? null,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    answered: false,
  };
}

function normalizeOutgoing(text) {
  return {
    id: `local_${Date.now()}_${Math.random()}`,
    sender: "VISITOR",
    text,
    step: null,
    renderHint: null,
    timestamp: new Date().toISOString(),
  };
}

export default function ChatWidget() {
  const searchParams = useSearchParams();
  const companyId =
    searchParams.get("companyId") ?? process.env.NEXT_PUBLIC_COMPANY_ID ?? "1";
  const currentWindowId = searchParams.get("widgetId");
  const widgetIdRef = useRef(null);
  if (widgetIdRef.current === null) {
    widgetIdRef.current = createWidgetId(currentWindowId);
  }
  const widgetId = widgetIdRef.current;
  const [messages, setMessages] = useState(() => loadStoredMessages(widgetId));
  const [input, setInput] = useState("");
  const [pendingSelection, setPendingSelection] = useState(() =>
    messages.some(
      (message) => message.renderHint?.options?.length > 0 && !message.answered,
    ),
  );
  const chatEndRef = useRef(null);
  const latestOptionMessageId = [...messages]
    .reverse()
    .find(
      (message) => message.renderHint?.options?.length > 0 && !message.answered,
    )?.id;

  const { sendMessage } = useStomp(widgetId, (raw) => {
    const normalized = normalizeIncoming(raw);

    setMessages((prev) => [...prev, normalized]);

    const hasButtons =
      normalized.renderHint?.renderType === "BUTTONS" ||
      normalized.renderHint?.renderType === "LIST";

    setPendingSelection(hasButtons);
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    saveStoredMessages(widgetId, messages);
  }, [messages, widgetId]);

  const markAnswered = (id) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, answered: true } : m)),
    );
  };

  const markOptionMessagesAnswered = (messagesToUpdate) =>
    messagesToUpdate.map((message) =>
      message.renderHint?.options?.length > 0
        ? { ...message, answered: true }
        : message,
    );

  const handleSend = () => {
    if (!input.trim()) return;
    const local = normalizeOutgoing(input);
    sendMessage({
      sender: "VISITOR",
      content: input,
      widgetId,
      companyId: String(companyId),
      timestamp: local.timestamp,
    });
    setMessages((prev) => [...markOptionMessagesAnswered(prev), local]);
    setInput("");
    setPendingSelection(false);
  };

  const handleOptionClick = (msgId, option) => {
    const local = normalizeOutgoing(option.label);
    sendMessage({
      sender: "VISITOR",
      content: option.label,
      selectionPayload: option.payload,
      widgetId,
      companyId: String(companyId),
      timestamp: local.timestamp,
    });
    markAnswered(msgId);
    setMessages((prev) => [...prev, local]);
    setPendingSelection(false);
  };

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-avatar">💬</div>
          <div>
            <div className="chat-title">Support</div>
            <div className="chat-status">
              <span className="status-dot" /> Online
            </div>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-row ${msg.sender === "VISITOR" ? "visitor" : "agent"}`}
          >
            <div
              className={`chat-message ${msg.sender === "VISITOR" ? "visitor" : "agent"}`}
            >
              <div className="chat-message-content">{msg.text}</div>
              <div className="chat-message-time">
                {msg.timestamp &&
                  new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </div>
            </div>

            {msg.renderHint?.options?.length > 0 && (
              <div className="chat-options">
                {msg.renderHint.options
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((opt) => (
                    <button
                      key={opt.payload}
                      className="chat-option-button"
                      disabled={
                        msg.answered || msg.id !== latestOptionMessageId
                      }
                      onClick={() => handleOptionClick(msg.id, opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-row">
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              pendingSelection
                ? "Pick an option above, or type here…"
                : "Type a message..."
            }
          />
          <button
            className="chat-send-button"
            onClick={handleSend}
            aria-label="Send"
          >
            ➤
          </button>
        </div>
        <div className="chat-powered">
          Powered by{" "}
          <span>
            <a href="https://letsngage.com/">NGAGE</a>
          </span>
        </div>
      </div>
    </div>
  );
}
