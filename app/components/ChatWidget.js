"use client";
import { useState, useRef, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import "../ChatWidget.css";
import moment from "moment";

function createWidgetId() {
  let id = localStorage.getItem("CHAT_WIDGET_ID");
  if (!id) {
    id = `visitor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem("CHAT_WIDGET_ID", id);
  }
  return id;
}

export default function ChatWidget() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);
  const clientRef = useRef(null);
  const widgetId = createWidgetId();

  // Connect STOMP only on client
  useEffect(() => {
    const socket = new SockJS("http://localhost:9090/chat"); // your backend URL
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("STOMP connected");
        client.subscribe(`/topic/messages/${widgetId}`, (msg) => {
          setMessages((prev) => [...prev, JSON.parse(msg.body)]);
        });
      },
    });
    client.activate();
    clientRef.current = client;

    return () => client.deactivate();
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;

    const msg = {
      sender: "VISITOR",
      content: input,
      widgetId: widgetId,
      timestamp: moment().format("YYYY-MM-DDTHH:mm:ss"),
    };

    // Send via STOMP if connected
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.publish({
        destination: "/app/send",
        body: JSON.stringify(msg),
      });
    }

    setMessages((prev) => [...prev, msg]);
    setInput("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-widget">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-avatar">💬</div>
          <div>
            <div className="chat-title">Support</div>
            <div className="chat-status">Online</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${msg.sender === "VISITOR" ? "visitor" : "agent"}`}
          >
            <div className="chat-message-content">{msg.content}</div>
            <div className="chat-message-time">
              {msg.timestamp &&
                new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        <div className="chat-input-row">
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
          />
          <button className="chat-send-button" onClick={handleSend}>
            Send
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
