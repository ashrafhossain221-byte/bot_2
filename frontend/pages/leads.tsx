import { useEffect, useState, useCallback } from "react";
import { Users, Flame, TrendingUp, Phone, Mail, RefreshCw, Filter } from "lucide-react";
import { fetchLeads, fetchLeadStats, Lead, LeadStats } from "@/lib/api";
import clsx from "clsx";

// ─── Badges ──────────────────────────────────────────────────────────────────

const STAGE_STYLES: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-600",
  LEAD: "bg-blue-100 text-blue-700",
  HOT_LEAD: "bg-orange-100 text-orange-700",
  CUSTOMER: "bg-green-100 text-green-700",
  REPEAT_CUSTOMER: "bg-purple-100 text-purple-700",
};

const PERSONA_STYLES: Record<string, string> = {
  price_sensitive: "bg-yellow-100 text-yellow-700",
  trust_seeker: "bg-sky-100 text-sky-700",
  fast_buyer: "bg-red-100 text-red-700",
  ready_to_buy: "bg-emerald-100 text-emerald-700",
  general: "bg-gray-100 text-gray-500",
};

const PERSONA_LABELS: Record<string, string> = {
  price_sensitive: "Price Sensitive",
  trust_seeker: "Trust Seeker",
  fast_buyer: "Fast Buyer",
  ready_to_buy: "Ready to Buy",
  general: "General",
};

function Badge({ value, styles }: { value: string; styles: Record<string, string> }) {
  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", styles[value] ?? "bg-gray-100 text-gray-600")}>
      {value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

function IntentBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "bg-red-500" : score >= 4 ? "bg-amber-400" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STAGES = ["", "NEW", "LEAD", "HOT_LEAD", "CUSTOMER", "REPEAT_CUSTOMER"];
const PERSONAS = ["", "general", "price_sensitive", "trust_seeker", "fast_buyer", "ready_to_buy"];
const CHANNELS = ["", "website", "telegram"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [stageFilter, setStageFilter] = useState("");
  const [personaFilter, setPersonaFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        fetchLeads({
          stage: stageFilter || undefined,
          persona: personaFilter || undefined,
          channel: channelFilter || undefined,
          skip: page * LIMIT,
          limit: LIMIT,
        }),
        fetchLeadStats(),
      ]);
      setLeads(leadsRes.leads);
      setTotal(leadsRes.total);
      setStats(statsRes);
    } catch {
      // silent fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [stageFilter, personaFilter, channelFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [stageFilter, personaFilter, channelFilter]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 mt-1">Behavior-detected leads from all channels</p>
        </div>
        <button onClick={load} className="btn-secondary">
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Leads" value={stats.total} icon={Users} color="bg-primary-600" />
          <StatCard title="Hot Leads" value={stats.hot_leads} icon={Flame} color="bg-orange-500" sub="Intent ≥ 7.0" />
          <StatCard
            title="Ready to Buy"
            value={stats.by_stage?.CUSTOMER ?? 0}
            icon={TrendingUp}
            color="bg-emerald-600"
            sub="Converted"
          />
          <StatCard
            title="Avg Intent Score"
            value={stats.avg_intent_score}
            icon={TrendingUp}
            color="bg-purple-600"
            sub="Out of 10"
          />
        </div>
      )}

      {/* Stage Funnel Mini-Bar */}
      {stats && (
        <div className="card p-5 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Lead Funnel</p>
          <div className="flex items-center gap-1 flex-wrap">
            {["NEW", "LEAD", "HOT_LEAD", "CUSTOMER", "REPEAT_CUSTOMER"].map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={clsx("px-2.5 py-1 rounded-lg text-xs font-medium", STAGE_STYLES[s])}>
                  {s.replace(/_/g, " ")}
                </span>
                <span className="text-sm font-bold text-gray-700">{stats.by_stage?.[s] ?? 0}</span>
                {s !== "REPEAT_CUSTOMER" && <span className="text-gray-300 text-sm">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <select className="input !w-auto text-sm" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select className="input !w-auto text-sm" value={personaFilter} onChange={(e) => setPersonaFilter(e.target.value)}>
          <option value="">All Personas</option>
          {PERSONAS.filter(Boolean).map((p) => <option key={p} value={p}>{PERSONA_LABELS[p]}</option>)}
        </select>
        <select className="input !w-auto text-sm" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="">All Channels</option>
          {CHANNELS.filter(Boolean).map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <span className="ml-auto text-sm text-gray-400">{total} results</span>
      </div>

      {/* Leads Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Channel</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Persona</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Intent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No leads yet. Leads are automatically detected as users chat.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {lead.name || <span className="text-gray-400 italic">Unknown</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {lead.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </span>
                        )}
                        {!lead.phone && !lead.email && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-gray-600">{lead.channel}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={lead.stage} styles={STAGE_STYLES} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={lead.persona} styles={PERSONA_STYLES} />
                    </td>
                    <td className="px-4 py-3">
                      <IntentBar score={lead.intent_score} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <button
              className="btn-secondary text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page + 1} of {Math.ceil(total / LIMIT)}
            </span>
            <button
              className="btn-secondary text-xs"
              disabled={(page + 1) * LIMIT >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
