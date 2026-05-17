/**
 * BotCore AI — Embeddable Chat Widget
 * Usage: <script src="https://your-backend.railway.app/widget/chat.js" defer></script>
 */
(function () {
  "use strict";

  const API_BASE = (function () {
    const scripts = document.getElementsByTagName("script");
    const me = scripts[scripts.length - 1];
    const src = me.getAttribute("src") || "";
    return src.replace(/\/widget\/chat\.js.*$/, "");
  })();

  const SESSION_KEY = "botcore_session_id";
  let sessionId = localStorage.getItem(SESSION_KEY) || null;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #botcore-widget * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    #botcore-widget { position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
    #botcore-toggle { width: 56px; height: 56px; border-radius: 50%; background: #2563eb; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(37,99,235,0.4); transition: transform 0.2s; }
    #botcore-toggle:hover { transform: scale(1.05); background: #1d4ed8; }
    #botcore-toggle svg { width: 26px; height: 26px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    #botcore-window { width: 340px; height: 480px; background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.15); border: 1px solid #e5e7eb; display: flex; flex-direction: column; overflow: hidden; }
    #botcore-header { background: #2563eb; padding: 14px 16px; display: flex; align-items: center; gap: 10px; }
    #botcore-header-name { color: #fff; font-size: 14px; font-weight: 600; flex: 1; }
    #botcore-header-status { color: rgba(255,255,255,0.75); font-size: 11px; }
    #botcore-close { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.7); line-height: 1; font-size: 20px; padding: 0; }
    #botcore-close:hover { color: #fff; }
    #botcore-messages { flex: 1; overflow-y: auto; padding: 14px; background: #f9fafb; display: flex; flex-direction: column; gap: 10px; }
    .bc-bubble { max-width: 80%; padding: 9px 13px; border-radius: 16px; font-size: 13px; line-height: 1.5; word-break: break-word; }
    .bc-bubble.user { background: #2563eb; color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
    .bc-bubble.bot { background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; align-self: flex-start; }
    .bc-typing { display: flex; gap: 4px; align-items: center; padding: 10px 13px; }
    .bc-dot { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: bc-bounce 1.2s infinite; }
    .bc-dot:nth-child(2) { animation-delay: 0.2s; }
    .bc-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bc-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
    #botcore-input-row { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #e5e7eb; background: #fff; }
    #botcore-input { flex: 1; border: 1px solid #d1d5db; border-radius: 20px; padding: 8px 14px; font-size: 13px; outline: none; }
    #botcore-input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
    #botcore-send { width: 36px; height: 36px; border-radius: 50%; background: #2563eb; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    #botcore-send:disabled { opacity: 0.4; cursor: default; }
    #botcore-send svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `;
  document.head.appendChild(style);

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const container = document.createElement("div");
  container.id = "botcore-widget";
  container.innerHTML = `
    <div id="botcore-window" style="display:none">
      <div id="botcore-header">
        <div>
          <div id="botcore-header-name">BotCore</div>
          <div id="botcore-header-status">Online</div>
        </div>
        <button id="botcore-close">&times;</button>
      </div>
      <div id="botcore-messages"></div>
      <div id="botcore-input-row">
        <input id="botcore-input" type="text" placeholder="Type a message..." autocomplete="off" />
        <button id="botcore-send">
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
    <button id="botcore-toggle">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
  `;
  document.body.appendChild(container);

  const win = document.getElementById("botcore-window");
  const messages = document.getElementById("botcore-messages");
  const input = document.getElementById("botcore-input");
  const sendBtn = document.getElementById("botcore-send");
  const toggle = document.getElementById("botcore-toggle");
  const closeBtn = document.getElementById("botcore-close");

  // ── State ────────────────────────────────────────────────────────────────────
  let isOpen = false;
  let isSending = false;

  function appendBubble(role, text) {
    const div = document.createElement("div");
    div.className = `bc-bubble ${role}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "bc-bubble bot bc-typing";
    div.innerHTML = '<div class="bc-dot"></div><div class="bc-dot"></div><div class="bc-dot"></div>';
    div.id = "bc-typing-indicator";
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById("bc-typing-indicator");
    if (el) el.remove();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isSending) return;
    input.value = "";
    isSending = true;
    sendBtn.disabled = true;

    appendBubble("user", text);
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      const data = await res.json();
      hideTyping();
      if (data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem(SESSION_KEY, sessionId);
      }
      appendBubble("bot", data.reply || "Sorry, something went wrong.");
    } catch {
      hideTyping();
      appendBubble("bot", "Unable to connect. Please try again.");
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  toggle.addEventListener("click", () => {
    isOpen = !isOpen;
    win.style.display = isOpen ? "flex" : "none";
    win.style.flexDirection = "column";
    if (isOpen && messages.children.length === 0) {
      appendBubble("bot", "Hi! How can I help you today?");
    }
    if (isOpen) setTimeout(() => input.focus(), 50);
  });

  closeBtn.addEventListener("click", () => {
    isOpen = false;
    win.style.display = "none";
  });

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
