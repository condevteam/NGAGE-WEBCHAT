"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import "../ChatWidget.css";

function createWidgetId() {
  let id = localStorage.getItem("CHAT_WIDGET_ID");
  if (!id) {
    id = `visitor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem("CHAT_WIDGET_ID", id);
  }
  return id;
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

export default function ChatWidget({ companyId = "1" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingSelection, setPendingSelection] = useState(false);
  const chatEndRef = useRef(null);
  const clientRef = useRef(null);
  const seenEventIds = useRef(new Set());
  const widgetIdRef = useRef(null);
  if (widgetIdRef.current === null) widgetIdRef.current = createWidgetId();
  const widgetId = widgetIdRef.current;

  const publishRaw = useCallback((payload) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.publish({
        destination: "/app/send",
        body: JSON.stringify(payload),
      });
    }
  }, []);

  useEffect(() => {
    const socket = new SockJS("http://localhost:9090/chat");
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/chatbot/${widgetId}`, (msg) => {
          const raw = JSON.parse(msg.body);
          if (raw.eventId) {
            if (seenEventIds.current.has(raw.eventId)) return;
            seenEventIds.current.add(raw.eventId);
          }
          const normalized = normalizeIncoming(raw);
          setMessages((prev) => [...prev, normalized]);

          const hasButtons =
            normalized.renderHint?.renderType === "BUTTONS" ||
            normalized.renderHint?.renderType === "LIST";
          setPendingSelection(hasButtons);
        });
      },
    });
    client.activate();
    clientRef.current = client;
    return () => client.deactivate();
  }, [widgetId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const markAnswered = (id) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, answered: true } : m)),
    );
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const local = normalizeOutgoing(input);
    publishRaw({
      sender: "VISITOR",
      content: input,
      widgetId,
      companyId: String(companyId),
      timestamp: local.timestamp,
    });
    setMessages((prev) => [...prev, local]);
    setInput("");
    setPendingSelection(false);
  };

  const handleOptionClick = (msgId, option) => {
    const local = normalizeOutgoing(option.label);
    publishRaw({
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
                      disabled={msg.answered}
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
