(function () {
  const widgetId = window.CHAT_WIDGET_ID || "default";

  // --- Icons ---
  const chatIcon = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
      <path d="M2 3h20v14H6l-4 4V3z"/>
    </svg>
  `;

  const closeIcon = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
      <path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  // --- Notification sound ---
  const audio = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");

  // --- Create iframe ---
  const iframe = document.createElement("iframe");
  iframe.src = `http://localhost:3001?widgetId=${widgetId}`;
  iframe.style.position = "fixed";
  iframe.style.bottom = "90px";
  iframe.style.right = "20px";
  iframe.style.width = "340px";
  iframe.style.height = "520px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 2px 6px 2px";
  iframe.style.zIndex = "9999";
  iframe.style.display = "none";
  iframe.style.transition = "all 0.3s ease";
  iframe.id = "chat-widget-frame";

  document.body.appendChild(iframe);

  // --- Create button ---
  const button = document.createElement("div");
  button.innerHTML = chatIcon;

  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.width = "64px";
  button.style.height = "64px";
  button.style.borderRadius = "50%";
  button.style.background = "#d41111";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.cursor = "pointer";
  button.style.zIndex = "10000";
  button.style.boxShadow = "rgba(14, 30, 37, 0.12) 0px 2px 4px 0px, rgba(14, 30, 37, 0.32) 0px 2px 16px 0px";
  button.style.transition = "all 0.25s ease";

  document.body.appendChild(button);

  // --- Badge ---
  const badge = document.createElement("div");
  badge.style.position = "absolute";
  badge.style.top = "8px";
  badge.style.right = "8px";
  badge.style.minWidth = "18px";
  badge.style.height = "18px";
  badge.style.background = "red";
  badge.style.color = "white";
  badge.style.borderRadius = "50%";
  badge.style.fontSize = "12px";
  badge.style.display = "flex";
  badge.style.alignItems = "center";
  badge.style.justifyContent = "center";
  badge.style.padding = "2px";
  badge.style.display = "none";

  button.appendChild(badge);

  let unreadCount = 0;
  let isOpen = false;

  // --- Hover animation ---
  button.onmouseenter = () => (button.style.transform = "scale(1.1)");
  button.onmouseleave = () => (button.style.transform = "scale(1)");

  // --- Toggle ---
  button.onclick = function () {
    isOpen = !isOpen;

    if (isOpen) {
      iframe.style.display = "block";
      iframe.style.opacity = "1";
      iframe.style.transform = "translateY(0)";
      button.innerHTML = closeIcon;

      // reset unread
      unreadCount = 0;
      badge.style.display = "none";
    } else {
      iframe.style.opacity = "0";
      iframe.style.transform = "translateY(20px)";
      setTimeout(() => (iframe.style.display = "none"), 300);
      button.innerHTML = chatIcon;
    }
  };

  // --- Listen messages from iframe ---
  window.addEventListener("message", function (event) {
    if (!event.data) return;

    if (event.data.type === "NEW_MESSAGE") {
      if (!isOpen) {
        unreadCount++;
        badge.innerText = unreadCount;
        badge.style.display = "flex";

        // play sound
        audio.play().catch(() => {});
      }
    }
  });
})();
