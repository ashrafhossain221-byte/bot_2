import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, MessageSquare, Users, ShoppingCart, RefreshCw,
  Percent, Star, BarChart2, Activity,
} from "lucide-react";
import clsx from "clsx";
import { fetchAnalytics, AnalyticsData } from "@/lib/api";

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function MiniBarChart({
  data,
  color = "bg-primary-500",
  height = "h-20",
}: {
  data: { date: string; value: number }[];
  color?: string;
  height?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={`flex items-end gap-0.5 ${height} w-full`}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${d.date}: ${d.value}`}>
          <div
            className={`w-full rounded-t ${color} opacity-80 group-hover:opacity-100 transition-all`}
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Funnel Bar ───────────────────────────────────────────────────────────────

const FUNNEL_COLORS: Record<string, string> = {
  NEW: "bg-gray-400",
  LEAD: "bg-blue-500",
  HOT_LEAD: "bg-orange-500",
  CUSTOMER: "bg-green-500",
  REPEAT_CUSTOMER: "bg-purple-500",
};

function FunnelBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs text-gray-600 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${FUNNEL_COLORS[label] ?? "bg-gray-400"} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums text-gray-700">{value}</span>
      <span className="w-8 text-right text-xs text-gray-400">{pct}%</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

const CHANNEL_ICONS: Record<string, string> = {
  website: "🌐", telegram: "✈️", whatsapp: "📱",
  facebook: "📘", instagram: "📸",
};

const PERSONA_LABELS: Record<string, string> = {
  price_sensitive: "Price Sensitive", trust_seeker: "Trust Seeker",
  fast_buyer: "Fast Buyer", ready_to_buy: "Ready to Buy", general: "General",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchAnalytics(days)); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const funnel = data?.funnel ?? {};
  const totalFunnel = Object.values(funnel).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Performance metrics across all channels</p>
        </div>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                days === opt.value
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {opt.label}
            </button>
          ))}
          <button onClick={load} className="btn-secondary">
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        <StatCard label="Conversations" value={s?.total_conversations ?? "—"} sub={`${s?.response_rate ?? 0}% response rate`} icon={MessageSquare} color="bg-primary-600" />
        <StatCard label="Leads Generated" value={s?.total_leads ?? "—"} sub={`${s?.avg_intent_score ?? 0} avg intent`} icon={Users} color="bg-blue-600" />
        <StatCard label="Conversion Rate" value={`${s?.conversion_rate ?? 0}%`} sub={`${s?.converted ?? 0} customers`} icon={Percent} color="bg-green-600" />
        <StatCard label="Revenue" value={s ? `৳${s.total_revenue.toLocaleString()}` : "—"} sub="dispatched + delivered" icon={ShoppingCart} color="bg-violet-600" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Msg / Conversation" value={s?.msg_per_conversation ?? "—"} icon={Activity} color="bg-amber-500" />
        <StatCard label="Hot Lead Conversion" value={`${s?.hot_conversion_rate ?? 0}%`} icon={Star} color="bg-orange-500" />
        <StatCard label="Response Rate" value={`${s?.response_rate ?? 0}%`} icon={BarChart2} color="bg-teal-600" />
        <StatCard label="Avg Intent Score" value={s?.avg_intent_score ?? "—"} sub="out of 10" icon={TrendingUp} color="bg-rose-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">
        {/* Daily messages */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">User Messages — Last {days} Days</h2>
          <p className="text-xs text-gray-400 mb-4">Daily incoming messages from all channels</p>
          {loading ? (
            <div className="h-20 bg-gray-50 rounded animate-pulse" />
          ) : (
            <MiniBarChart data={data?.daily_messages ?? []} color="bg-primary-500" height="h-24" />
          )}
          <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
            <span>{data?.daily_messages?.[0]?.date}</span>
            <span>{data?.daily_messages?.at(-1)?.date}</span>
          </div>
        </div>

        {/* By channel */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">By Channel</h2>
          <div className="space-y-3">
            {Object.entries(data?.by_channel ?? {}).map(([ch, cnt]) => (
              <div key={ch} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{CHANNEL_ICONS[ch] ?? "💬"} {ch}</span>
                <span className="font-semibold">{cnt}</span>
              </div>
            ))}
            {!Object.keys(data?.by_channel ?? {}).length && (
              <p className="text-xs text-gray-400">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="card p-5 mb-7">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Revenue (BDT) — Last {days} Days</h2>
        <p className="text-xs text-gray-400 mb-4">Dispatched + delivered orders only</p>
        {loading ? (
          <div className="h-20 bg-gray-50 rounded animate-pulse" />
        ) : (
          <MiniBarChart data={data?.daily_revenue ?? []} color="bg-green-500" height="h-20" />
        )}
      </div>

      {/* Lead funnel + persona */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Lead Funnel</h2>
          <div className="space-y-3">
            {["NEW", "LEAD", "HOT_LEAD", "CUSTOMER", "REPEAT_CUSTOMER"].map((stage) => (
              <FunnelBar key={stage} label={stage} value={funnel[stage] ?? 0} total={totalFunnel} />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">By Persona</h2>
          <div className="space-y-3">
            {Object.entries(data?.by_persona ?? {}).map(([p, cnt]) => {
              const pct = totalFunnel > 0 ? Math.round((cnt / totalFunnel) * 100) : 0;
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-gray-600 shrink-0">{PERSONA_LABELS[p] ?? p}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold tabular-nums text-gray-700">{cnt}</span>
                </div>
              );
            })}
            {!Object.keys(data?.by_persona ?? {}).length && (
              <p className="text-xs text-gray-400">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily leads + orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Leads Captured — Last {days} Days</h2>
          {loading ? <div className="h-16 bg-gray-50 rounded animate-pulse" /> : (
            <MiniBarChart data={data?.daily_leads ?? []} color="bg-blue-400" height="h-16" />
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Orders Placed — Last {days} Days</h2>
          {loading ? <div className="h-16 bg-gray-50 rounded animate-pulse" /> : (
            <MiniBarChart data={data?.daily_orders ?? []} color="bg-violet-400" height="h-16" />
          )}
        </div>
      </div>
    </div>
  );
}
