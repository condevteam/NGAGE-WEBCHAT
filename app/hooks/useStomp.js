"use client";

import { useCallback, useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

export function useStomp(widgetId, onMessage) {
  const clientRef = useRef(null);
  const seenEventIds = useRef(new Set());

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS("http://localhost:9090/chat"),

      reconnectDelay: 5000,

      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect() {
        console.log("Connected");

        client.subscribe(`/topic/chatbot/${widgetId}`, (message) => {
          const raw = JSON.parse(message.body);

          if (raw.eventId) {
            if (seenEventIds.current.has(raw.eventId)) return;
            seenEventIds.current.add(raw.eventId);
          }

          onMessage(raw);
        });
      },

      onDisconnect() {
        console.log("Disconnected");
      },

      onWebSocketClose(evt) {
        console.log(evt);
      },

      onStompError(frame) {
        console.error(frame);
      },
    });

    client.activate();

    clientRef.current = client;

    return () => client.deactivate();
  }, [widgetId, onMessage]);

  const sendMessage = useCallback((payload) => {
    if (!clientRef.current?.connected) return false;

    clientRef.current.publish({
      destination: "/app/send",
      body: JSON.stringify(payload),
    });

    return true;
  }, []);

  return { sendMessage };
}
