"use client";

import { useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

export function useStomp(widgetId, onMessage) {
  const clientRef = useRef(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    // Create SockJS connection to Spring Boot WebSocket endpoint
    const socket = new SockJS("http://localhost:9090/chat"); // replace with your backend URL

    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000, // auto-reconnect
      onConnect: () => {
        connectedRef.current = true;
        console.log("STOMP connected for widget:", widgetId);

        // Subscribe to messages for this widget
        client.subscribe(`/topic/messages/${widgetId}`, (msg) => {
          onMessage(JSON.parse(msg.body));
        });
      },
      onStompError: (frame) => {
        console.error("Broker error:", frame);
      },
      onWebSocketClose: () => {
        connectedRef.current = false;
      },
    });

    client.activate();
    clientRef.current = client;

    // Cleanup
    return () => {
      client.deactivate();
      connectedRef.current = false;
    };
  }, [widgetId, onMessage]);

  // Send message safely
  const sendMessage = (msg) => {
    if (clientRef.current && connectedRef.current) {
      clientRef.current.publish({
        destination: "/app/send",
        body: JSON.stringify(msg),
      });
    } else {
      console.warn("STOMP client not connected yet");
    }
  };

  return sendMessage;
}
