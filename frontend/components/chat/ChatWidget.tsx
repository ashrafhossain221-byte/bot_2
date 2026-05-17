import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Send, Bot, Loader2,
  Paperclip, Mic, MicOff, FileText, Image, Volume2,
} from "lucide-react";
import clsx from "clsx";
import { sendChatMessage, uploadFile } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  fileType?: "voice" | "image" | "document";
  fileName?: string;
}

interface ChatWidgetProps {
  botName?: string;
  welcomeMessage?: string;
}

// ─── File type icons ──────────────────────────────────────────────────────────

function FileIcon({ type }: { type?: string }) {
  if (type === "voice") return <Volume2 className="w-3 h-3" />;
  if (type === "image") return <Image className="w-3 h-3" />;
  if (type === "document") return <FileText className="w-3 h-3" />;
  return null;
}

// ─── Recording indicator ──────────────────────────────────────────────────────

function RecordingDot() {
  return (
    <span className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      Recording…
    </span>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function ChatWidget({
  botName = "BotCore",
  welcomeMessage = "Hi! How can I help you today?",
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: welcomeMessage, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // File attach
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  // ── Text send ────────────────────────────────────────────────────────────

  const addAssistantMessage = (content: string, fileType?: Message["fileType"]) => {
    setMessages((prev) => [...prev, { role: "assistant", content, timestamp: new Date(), fileType }]);
  };

  const addUserMessage = (content: string, fileType?: Message["fileType"], fileName?: string) => {
    setMessages((prev) => [...prev, { role: "user", content, timestamp: new Date(), fileType, fileName }]);
  };

  const handleSend = async () => {
    // ── File pending ─────────────────────────────────────────────────────
    if (pendingFile) {
      const file = pendingFile;
      setPendingFile(null);
      const isImage = file.type.startsWith("image/");
      const isAudio = file.type.startsWith("audio/");
      const fileType = isImage ? "image" : isAudio ? "voice" : "document";
      addUserMessage(`[${fileType}: ${file.name}]`, fileType, file.name);
      setLoading(true);
      try {
        const res = await uploadFile(file, sessionId);
        setSessionId(res.session_id);
        addAssistantMessage(res.reply, res.file_type);
      } catch {
        addAssistantMessage("Sorry, I couldn't process your file. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Text ─────────────────────────────────────────────────────────────
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addUserMessage(text);
    setLoading(true);
    try {
      const res = await sendChatMessage(text, sessionId);
      setSessionId(res.session_id);
      addAssistantMessage(res.reply);
    } catch {
      addAssistantMessage("Sorry, I'm having trouble connecting. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── File attach ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    e.target.value = ""; // reset so same file can be re-selected
  };

  const clearPendingFile = () => setPendingFile(null);

  // ── Voice recording ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        addUserMessage("[Voice message]", "voice");
        setLoading(true);
        try {
          const res = await uploadFile(blob, sessionId, "recording.webm");
          setSessionId(res.session_id);
          addAssistantMessage(res.reply, "voice");
        } catch {
          addAssistantMessage("Sorry, I couldn't process your voice message.");
        } finally {
          setLoading(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      addAssistantMessage("Microphone access denied. Please allow mic permissions.");
    }
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const toggleRecording = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat Window */}
      {open && (
        <div
          className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: "520px" }}
        >
          {/* Header */}
          <div className="bg-primary-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{botName}</p>
              <p className="text-xs text-blue-100">
                {recording ? <RecordingDot /> : "Online · Text, Voice & Files"}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <Bot className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                )}
                <div
                  className={clsx(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                  )}
                >
                  {msg.fileType && (
                    <div className={clsx(
                      "flex items-center gap-1 text-xs mb-1 font-medium",
                      msg.role === "user" ? "text-blue-200" : "text-gray-400"
                    )}>
                      <FileIcon type={msg.fileType} />
                      <span className="capitalize">{msg.fileType}</span>
                      {msg.fileName && <span className="truncate max-w-[100px]"> · {msg.fileName}</span>}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <Bot className="w-3.5 h-3.5 text-primary-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Pending file preview */}
          {pendingFile && (
            <div className="px-3 py-2 bg-primary-50 border-t border-primary-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-600 flex-shrink-0" />
              <span className="flex-1 text-xs text-primary-700 truncate">{pendingFile.name}</span>
              <button onClick={clearPendingFile} className="text-primary-400 hover:text-primary-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input row */}
          <div className="px-3 py-3 border-t border-gray-200 bg-white flex items-center gap-2 flex-shrink-0">
            {/* File attach */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,audio/*,.pdf,.docx,.doc,.txt,.csv"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || recording}
              title="Attach file (image, PDF, DOCX, audio…)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice record */}
            <button
              onClick={toggleRecording}
              disabled={loading || !!pendingFile}
              title={recording ? "Stop recording" : "Record voice message"}
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40",
                recording
                  ? "bg-red-100 text-red-500 hover:bg-red-200 animate-pulse"
                  : "text-gray-400 hover:text-primary-600 hover:bg-primary-50"
              )}
            >
              {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 min-w-0"
              placeholder={pendingFile ? "Press send to upload…" : recording ? "Recording…" : "Type a message…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading || recording}
            />

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !pendingFile) || loading || recording}
              className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center disabled:opacity-40 hover:bg-primary-700 transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-primary-600 shadow-lg flex items-center justify-center hover:bg-primary-700 transition-all hover:scale-105 active:scale-95"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>
    </div>
  );
}
