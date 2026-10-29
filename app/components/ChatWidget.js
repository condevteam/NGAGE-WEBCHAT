"use client";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import "../ChatWidget.css";
import { useStomp } from "../hooks/useStomp";
import { vitalMaxLength, validateVitalAnswer } from "../lib/vitalValidation.mjs";

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
        answered: hasOptions ? (!isLastMessage || message.answered) : message.answered,
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [inputError, setInputError] = useState("");
  const [uploading, setUploading] = useState(false);
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
  const activeVital = [...messages].reverse().find(
    (message) => message.sender === "AGENT" && message.step === "STEP_VITAL"
      && message.renderHint?.inputSpec && !message.answered,
  );
  const activeSpec = activeVital?.renderHint?.inputSpec;
  const activeType = activeSpec?.inputType?.toLowerCase();
  const activeMaxLength = vitalMaxLength(activeSpec);

  const { sendMessage } = useStomp(widgetId, (raw) => {
    const normalized = normalizeIncoming(raw);

    setMessages((prev) => [...prev, normalized]);

    const hasButtons =
      normalized.renderHint?.renderType === "BUTTONS" ||
      normalized.renderHint?.renderType === "LIST";

    setPendingSelection(hasButtons);
    if (normalized.renderHint?.inputSpec || hasButtons) {
      setInputError("");
      setInput("");
      setSelectedFile(null);
    }
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
    if (activeType === "select" || activeType === "file") return;
    const value = activeType === "date" && input
      ? `${input.slice(8, 10)}/${input.slice(5, 7)}/${input.slice(0, 4)}`
      : input.trim();
    if (!value && !activeSpec) return;
    const validationError = validateVitalAnswer(activeSpec, value);
    if (validationError) {
      setInputError(validationError);
      return;
    }
    const local = normalizeOutgoing(value);
    const sent = sendMessage({
      sender: "VISITOR",
      content: value,
      widgetId,
      companyId: String(companyId),
      timestamp: local.timestamp,
    });
    if (!sent) {
      setInputError("Connection lost. Please try again.");
      return;
    }
    setMessages((prev) => [...markOptionMessagesAnswered(prev).map((message) =>
      message.id === activeVital?.id ? { ...message, answered: true } : message), local]);
    setInput("");
    setInputError("");
    setPendingSelection(false);
  };

  const handleOptionClick = (msgId, option) => {
    const local = normalizeOutgoing(option.label);
    const sent = sendMessage({
      sender: "VISITOR",
      content: option.label,
      selectionPayload: option.payload,
      widgetId,
      companyId: String(companyId),
      timestamp: local.timestamp,
    });
    if (!sent) {
      setInputError("Connection lost. Please try again.");
      return;
    }
    markAnswered(msgId);
    setMessages((prev) => [...prev, local]);
    setPendingSelection(false);
  };

  const handleFileSend = async () => {
    if (!activeVital || !selectedFile || uploading) {
      setInputError(activeSpec?.required ? "Required" : "Choose a file");
      return;
    }
    const file = selectedFile;
    const maxBytes = activeSpec.maxFileSizeBytes ?? 100_000_000;
    if (file.size > maxBytes) {
      setInputError("Maximum file size is 100 MB");
      return;
    }
    if (activeSpec.accept) {
      const accepted = activeSpec.accept.split(",").map((rule) => rule.trim().toLowerCase());
      const name = file.name.toLowerCase();
      const mime = file.type.toLowerCase();
      if (!accepted.some((rule) => rule.startsWith(".") ? name.endsWith(rule)
        : rule.endsWith("/*") ? mime.startsWith(rule.slice(0, -1)) : mime === rule)) {
        setInputError(activeSpec.validationMessage || "File type is not allowed");
        return;
      }
    }
    const form = new FormData();
    form.append("widgetId", widgetId);
    form.append("companyId", String(companyId));
    form.append("file", file);
    setUploading(true);
    setInputError("");
    try {
      const response = await fetch("/api/vitals/file", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      const local = normalizeOutgoing(file.name);
      setMessages((prev) => {
        const updated = prev.map((message) => message.id === activeVital.id
          ? { ...message, answered: true } : message);
        const index = updated.findIndex((message) => message.id === activeVital.id);
        updated.splice(index < 0 ? updated.length : index + 1, 0, local);
        return updated;
      });
      setSelectedFile(null);
    } catch (error) {
      setInputError(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`chat-widget ${activeType === "address" ? "chat-widget-address" : ""}`}>
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
          {activeType === "file" ? (
            <>
              <input className="chat-input" type="file" accept={activeSpec.accept || undefined}
                disabled={uploading} onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); setInputError(""); }} />
              <button className="chat-send-button" onClick={handleFileSend} disabled={uploading}
                aria-label="Upload file">{uploading ? "…" : "➤"}</button>
            </>
          ) : activeType === "select" ? (
            <span className="chat-input chat-input-instruction">Pick an option above</span>
          ) : (
            <>
              {activeType === "address" ? (
                <textarea className="chat-input chat-textarea" value={input} maxLength={activeMaxLength}
                  aria-label={activeVital?.text || "Address"}
                  onChange={(e) => { setInput(e.target.value); setInputError(""); }}
                  onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && handleSend()}
                  placeholder="Type an address..." />
              ) : (
                <input className="chat-input"
                  aria-label={activeVital?.text || "Message"}
                  type={activeType === "date" ? "date" : activeType === "email" ? "email"
                    : activeType === "phone" || activeType === "whatsapp_number" ? "tel" : "text"}
                  maxLength={activeMaxLength || undefined}
                  value={input} onChange={(e) => { setInput(e.target.value); setInputError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={activeType === "date" ? undefined : pendingSelection
                    ? "Pick an option above, or type here…" : "Type a message..."} />
              )}
              <button className="chat-send-button" onClick={handleSend} aria-label="Send">➤</button>
            </>
          )}
        </div>
        {inputError && <div className="chat-input-error" role="alert">{inputError}</div>}
        {activeMaxLength && activeType !== "date" && activeType !== "select" && activeType !== "file"
          && <div className="chat-input-count">{input.length}/{activeMaxLength} characters</div>}
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
