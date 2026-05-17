import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare, Users, Flame, TrendingUp, Bot,
  RefreshCw, ArrowRight, Phone, AlertCircle, ShoppingCart,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchDashboard,
  DashboardData,
  RecentConversation,
  HotLeadEntry,
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
  price_sensitive: "Price Sensitive",
  trust_seeker: "Trust Seeker",
  fast_buyer: "Fast Buyer",
  ready_to_buy: "Ready to Buy",
  general: "General",
};

const CHANNEL_ICON: Record<string, string> = {
  website: "🌐",
  telegram: "✈️",
  whatsapp: "📱",
  facebook: "📘",
  instagram: "📸",
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, icon: Icon, color, href,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; href?: string;
}) {
  const inner = (
    <div className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Mini Bar Chart (trend) ───────────────────────────────────────────────────

function TrendBar({ data }: { data: { date: string; conversations: number }[] }) {
  const max = Math.max(...data.map((d) => d.conversations), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full bg-primary-500 rounded-sm opacity-80 group-hover:opacity-100 transition-all relative"
            style={{ height: `${(d.conversations / max) * 48}px`, minHeight: d.conversations > 0 ? "4px" : "0" }}
            title={`${d.date}: ${d.conversations}`}
          />
          <span className="text-gray-400 text-[9px] hidden sm:block truncate w-full text-center">
            {d.date.split(" ")[1]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Funnel Bar ───────────────────────────────────────────────────────────────

function FunnelRow({ label, value, total, style }: {
  label: string; value: number; total: number; style: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={clsx("w-24 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium text-center", style)}>
        {label.replace(/_/g, " ")}
      </span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-semibold text-gray-700 tabular-nums">{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await fetchDashboard());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ov = data?.overview;
  const funnel = data?.funnel ?? {};
  const totalFunnel = Object.values(funnel).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 lg:p-8 max-w-screen-xl">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Real-time overview of all channels</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Could not load dashboard. Make sure the backend is running and configured.
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-7">
        <StatCard title="Total Conversations" value={ov?.total_conversations ?? "—"} sub={`+${ov?.new_today ?? 0} today`} icon={MessageSquare} color="bg-primary-600" href="/conversations" />
        <StatCard title="Total Leads" value={ov?.total_leads ?? "—"} sub={`${ov?.hot_leads ?? 0} hot`} icon={Users} color="bg-blue-600" href="/leads" />
        <StatCard title="Hot Leads" value={ov?.hot_leads ?? "—"} sub="Intent ≥ 7.0" icon={Flame} color="bg-orange-500" href="/leads?stage=HOT_LEAD" />
        <StatCard title="Customers" value={ov?.customers ?? "—"} sub="Converted" icon={TrendingUp} color="bg-emerald-600" href="/leads?stage=CUSTOMER" />
        <StatCard title="Orders" value={ov?.total_orders ?? "—"} sub={`৳${((ov?.revenue ?? 0)).toLocaleString()} revenue`} icon={ShoppingCart} color="bg-violet-600" href="/orders" />
      </div>

      {/* Mid row: Funnel + Trend + Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">

        {/* Lead Funnel */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Lead Funnel</h2>
          <div className="space-y-3">
            {(["NEW","LEAD","HOT_LEAD","CUSTOMER","REPEAT_CUSTOMER"] as const).map((s) => (
              <FunnelRow key={s} label={s} value={funnel[s] ?? 0} total={totalFunnel} style={STAGE_STYLES[s]} />
            ))}
          </div>
        </div>

        {/* 7-day Trend */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            Conversations — Last 7 Days
          </h2>
          {data?.trend ? (
            <TrendBar data={data.trend} />
          ) : (
            <div className="h-16 bg-gray-50 rounded animate-pulse" />
          )}
          <p className="text-xs text-gray-400 mt-3">
            {ov?.new_this_week ?? 0} this week · {ov?.total_messages ?? 0} total messages
          </p>
        </div>

        {/* Channel & Persona */}
        <div className="card p-5 lg:col-span-1 flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">By Channel</h2>
            <div className="space-y-2">
              {Object.entries(data?.by_channel ?? {}).map(([ch, cnt]) => (
                <div key={ch} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {CHANNEL_ICON[ch] ?? "💬"} {ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </span>
                  <span className="font-semibold text-gray-800">{cnt}</span>
                </div>
              ))}
              {!Object.keys(data?.by_channel ?? {}).length && (
                <p className="text-xs text-gray-400">No data yet</p>
              )}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">By Persona</h2>
            <div className="space-y-2">
              {Object.entries(data?.by_persona ?? {}).map(([p, cnt]) => (
                <div key={p} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{PERSONA_LABELS[p] ?? p}</span>
                  <span className="font-semibold text-gray-800">{cnt}</span>
                </div>
              ))}
              {!Object.keys(data?.by_persona ?? {}).length && (
                <p className="text-xs text-gray-400">No data yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Recent Conversations + Hot Leads */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Recent Conversations */}
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Recent Conversations</h2>
            <Link href="/conversations" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              ))
            ) : data?.recent_conversations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No conversations yet</p>
            ) : (
              data?.recent_conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/conversations?id=${conv.id}`}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-sm">
                    {CHANNEL_ICON[conv.channel] ?? "💬"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {conv.user_name || "Unknown"}
                      </span>
                      <span className={clsx("flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium", STAGE_STYLES[conv.lead_stage])}>
                        {conv.lead_stage.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {conv.last_message_role === "assistant" ? "Bot: " : ""}
                      {conv.last_message || "—"}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(conv.updated_at)}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Hot Leads Panel */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              Hot Leads
            </h2>
            <Link href="/leads?stage=HOT_LEAD" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2 mb-1.5" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                </div>
              ))
            ) : !data?.hot_leads_panel.length ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">
                No hot leads yet.<br />
                <span className="text-xs text-gray-300">Intent ≥ 7.0 triggers HOT_LEAD</span>
              </p>
            ) : (
              data?.hot_leads_panel.map((hl) => (
                <Link
                  key={hl.lead_id}
                  href={`/conversations?id=${hl.conversation_id}`}
                  className="block px-5 py-3 hover:bg-orange-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {hl.name || "Unknown"}
                      </p>
                      {hl.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {hl.phone}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{hl.channel}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-orange-600">{hl.intent_score.toFixed(1)}</span>
                      <p className="text-[10px] text-gray-400">/10</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
