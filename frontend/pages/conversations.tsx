import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import {
  Search, MessageSquare, Phone, Mail, User,
  RefreshCw, Bot, ChevronRight, Filter,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchConversations,
  fetchMessages,
  ConversationItem,
  ConversationMessage,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_STYLES: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-600",
  LEAD: "bg-blue-100 text-blue-700",
  HOT_LEAD: "bg-orange-100 text-orange-700",
  CUSTOMER: "bg-green-100 text-green-700",
  REPEAT_CUSTOMER: "bg-purple-100 text-purple-700",
};

const PERSONA_LABELS: Record<string, string> = {
  price_sensitive: "💰 Price Sensitive",
  trust_seeker: "🛡 Trust Seeker",
  fast_buyer: "⚡ Fast Buyer",
  ready_to_buy: "✅ Ready to Buy",
  general: "👤 General",
};

const CHANNEL_ICON: Record<string, string> = {
  website: "🌐",
  telegram: "✈️",
  whatsapp: "📱",
  facebook: "📘",
  instagram: "📸",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString();
}

function IntentBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "bg-red-500" : score >= 4 ? "bg-amber-400" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-6 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConvItem({
  conv, selected, onClick,
}: {
  conv: ConversationItem; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors",
        selected && "bg-primary-50 border-l-2 border-l-primary-600"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm mt-0.5">
          {CHANNEL_ICON[conv.channel] ?? "💬"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-medium text-gray-900 truncate">
              {conv.user_name || conv.external_user_id.slice(0, 10) + "…"}
            </span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(conv.updated_at)}</span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {conv.last_message_role === "assistant" ? "Bot: " : ""}
            {conv.last_message || "—"}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {conv.lead && (
              <span className={clsx("px-1.5 py-0.5 rounded-full text-[10px] font-medium", STAGE_STYLES[conv.lead.stage])}>
                {conv.lead.stage.replace(/_/g, " ")}
              </span>
            )}
            <span className="text-[10px] text-gray-400">{conv.message_count} msgs</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Chat Viewer ─────────────────────────────────────────────────────────────

function ChatViewer({ messages, loading }: { messages: ConversationMessage[]; loading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView(); }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
      {messages.map((msg) => (
        <div key={msg.id} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
          {msg.role === "assistant" && (
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
              <Bot className="w-3.5 h-3.5 text-primary-600" />
            </div>
          )}
          <div
            className={clsx(
              "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-primary-600 text-white rounded-br-sm"
                : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
            )}
          >
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            <p className={clsx("text-[10px] mt-1", msg.role === "user" ? "text-blue-200" : "text-gray-400")}>
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Lead Profile Panel ───────────────────────────────────────────────────────

function LeadProfile({ conv }: { conv: ConversationItem }) {
  const lead = conv.lead;
  return (
    <div className="w-64 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto p-5 hidden xl:block">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Lead Profile</h3>

      {/* Identity */}
      <div className="flex flex-col gap-2 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {conv.user_name || lead?.name || "Unknown"}
            </p>
            <p className="text-xs text-gray-400 capitalize">{conv.channel}</p>
          </div>
        </div>
        {lead?.phone && (
          <p className="flex items-center gap-2 text-xs text-gray-600">
            <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> {lead.phone}
          </p>
        )}
        {lead?.email && (
          <p className="flex items-center gap-2 text-xs text-gray-600 break-all">
            <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> {lead.email}
          </p>
        )}
      </div>

      {/* Stage */}
      {lead && (
        <>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1.5">Stage</p>
            <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", STAGE_STYLES[lead.stage])}>
              {lead.stage.replace(/_/g, " ")}
            </span>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1.5">Persona</p>
            <p className="text-sm text-gray-700">{PERSONA_LABELS[lead.persona] ?? lead.persona}</p>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1.5">Intent Score</p>
            <IntentBar score={lead.intent_score} />
          </div>
        </>
      )}

      {/* Conversation meta */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Messages</span>
          <span className="font-medium text-gray-700">{conv.message_count}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Started</span>
          <span className="font-medium text-gray-700">{new Date(conv.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Last active</span>
          <span className="font-medium text-gray-700">{timeAgo(conv.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CHANNELS = ["", "website", "telegram"];
const STAGES = ["", "NEW", "LEAD", "HOT_LEAD", "CUSTOMER", "REPEAT_CUSTOMER"];
const LIMIT = 30;

export default function ConversationsPage() {
  const router = useRouter();

  const [convs, setConvs] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  // Allow pre-selecting a conversation via URL param ?id=
  useEffect(() => {
    if (router.query.id) setSelectedId(router.query.id as string);
  }, [router.query.id]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetchConversations({
        channel: channelFilter || undefined,
        stage: stageFilter || undefined,
        search: search || undefined,
        skip: page * LIMIT,
        limit: LIMIT,
      });
      setConvs(res.conversations);
      setTotal(res.total);
    } finally {
      setListLoading(false);
    }
  }, [channelFilter, stageFilter, search, page]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { setPage(0); }, [channelFilter, stageFilter, search]);

  // Load messages + full conv when selection changes
  useEffect(() => {
    if (!selectedId) return;
    const conv = convs.find((c) => c.id === selectedId);
    if (conv) setSelectedConv(conv);

    setMsgLoading(true);
    fetchMessages(selectedId)
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]))
      .finally(() => setMsgLoading(false));
  }, [selectedId, convs]);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Conversation List ─────────────────────────────────────────── */}
      <div className={clsx(
        "flex flex-col border-r border-gray-200 bg-white",
        selectedId ? "hidden sm:flex w-72 flex-shrink-0" : "flex-1 sm:w-80 sm:flex-shrink-0"
      )}>
        {/* List Header */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-semibold text-gray-900">Conversations</h1>
            <button onClick={loadList} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className={clsx("w-4 h-4", listLoading && "animate-spin")} />
            </button>
          </div>
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="input pl-8 text-sm"
              placeholder="Search name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Filters */}
          <div className="flex gap-2">
            <select className="input flex-1 text-xs" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="">All Channels</option>
              {CHANNELS.filter(Boolean).map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <select className="input flex-1 text-xs" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="">All Stages</option>
              {STAGES.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400 mt-2">{total} conversations</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-gray-100 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5 mt-0.5">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))
          ) : convs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No conversations found</p>
            </div>
          ) : (
            convs.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex gap-2 p-3 border-t border-gray-100">
              <button className="btn-secondary flex-1 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn-secondary flex-1 text-xs" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Chat Viewer ──────────────────────────────────────────────── */}
      {selectedId && selectedConv ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 bg-white flex-shrink-0">
            <button
              className="sm:hidden text-gray-400 hover:text-gray-600"
              onClick={() => setSelectedId(null)}
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-sm">
              {CHANNEL_ICON[selectedConv.channel] ?? "💬"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {selectedConv.user_name || selectedConv.external_user_id}
              </p>
              <p className="text-xs text-gray-400 capitalize">
                {selectedConv.channel} · {selectedConv.message_count} messages
              </p>
            </div>
            {selectedConv.lead && (
              <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", STAGE_STYLES[selectedConv.lead.stage])}>
                {selectedConv.lead.stage.replace(/_/g, " ")}
              </span>
            )}
          </div>

          {/* Chat + Profile layout */}
          <div className="flex flex-1 overflow-hidden">
            <ChatViewer messages={messages} loading={msgLoading} />
            <LeadProfile conv={selectedConv} />
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden sm:flex flex-col items-center justify-center text-gray-400 bg-gray-50">
          <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Select a conversation to view</p>
        </div>
      )}
    </div>
  );
}
