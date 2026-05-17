import { useEffect, useState, useCallback } from "react";
import {
  Zap, CheckCircle, Clock, XCircle, RefreshCw,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  AlertCircle, Send, Ban,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchFlows, fetchQueue, fetchAutomationStats,
  toggleFlow, AutomationFlow, ScheduledMsg, AutomationStats,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  lead_captured: "📋 Lead Captured",
  hot_lead: "🔥 Hot Lead",
  post_purchase: "🛍 Post Purchase",
  no_reply_24h: "⏰ No Reply 24h",
};

const TRIGGER_COLORS: Record<string, string> = {
  lead_captured: "bg-blue-100 text-blue-700",
  hot_lead: "bg-orange-100 text-orange-700",
  post_purchase: "bg-green-100 text-green-700",
  no_reply_24h: "bg-purple-100 text-purple-700",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  sent: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  cancelled: <Ban className="w-3.5 h-3.5 text-gray-400" />,
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-gray-50 text-gray-500",
};

function timeFromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60000) return "just now";
  if (abs < 3600000) return `${Math.floor(abs / 60000)}m`;
  if (abs < 86400000) return `${Math.floor(abs / 3600000)}h`;
  return `${Math.floor(abs / 86400000)}d`;
}

function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ─── Flow Card ────────────────────────────────────────────────────────────────

function FlowCard({ flow, onToggle }: { flow: AutomationFlow; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggle(); } finally { setToggling(false); }
  };

  return (
    <div className={clsx("card overflow-hidden transition-all", !flow.is_active && "opacity-60")}>
      <div className="flex items-start gap-3 p-5">
        {/* Trigger badge */}
        <span className={clsx("flex-shrink-0 mt-0.5 px-2.5 py-1 rounded-full text-xs font-medium", TRIGGER_COLORS[flow.trigger] ?? "bg-gray-100 text-gray-600")}>
          {TRIGGER_LABELS[flow.trigger] ?? flow.trigger}
        </span>

        {/* Name + steps */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{flow.name}</p>
            {flow.is_default && (
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">DEFAULT</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{flow.steps.length} step{flow.steps.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Expand + Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Show steps"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-40"
            title={flow.is_active ? "Deactivate" : "Activate"}
          >
            {flow.is_active
              ? <ToggleRight className="w-6 h-6 text-primary-600" />
              : <ToggleLeft className="w-6 h-6" />
            }
          </button>
        </div>
      </div>

      {/* Steps expanded */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 space-y-2">
          {flow.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">
                  {step.delay_hours === 0
                    ? "Immediately"
                    : step.delay_hours < 24
                      ? `After ${step.delay_hours}h`
                      : `After ${step.delay_hours / 24}d`}
                </p>
                <p className="text-sm text-gray-700 leading-snug">{step.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Queue Table ─────────────────────────────────────────────────────────────

const QUEUE_STATUSES = ["", "pending", "sent", "failed", "cancelled"];

function QueueTable({ msgs, loading }: { msgs: ScheduledMsg[]; loading: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Flow</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Message</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Channel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Scheduled</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : msgs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  No messages in queue yet. They appear here when automations fire.
                </td>
              </tr>
            ) : (
              msgs.map((msg) => (
                <tr key={msg.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-medium", TRIGGER_COLORS[msg.flow_name] ?? "bg-gray-100 text-gray-600")}>
                      {msg.flow_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-gray-700 truncate" title={msg.message}>{msg.message}</p>
                    {msg.error_message && (
                      <p className="text-[10px] text-red-500 mt-0.5 truncate">{msg.error_message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs text-gray-600">{msg.channel}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {isPast(msg.scheduled_at) ? "⏰ " : "🕐 "}
                    {new Date(msg.scheduled_at).toLocaleString([], {
                      month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    <span className="text-gray-400 ml-1">
                      ({isPast(msg.scheduled_at) ? "-" : "+"}{timeFromNow(msg.scheduled_at)})
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", STATUS_STYLES[msg.status])}>
                      {STATUS_ICON[msg.status]}
                      {msg.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [msgs, setMsgs] = useState<ScheduledMsg[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueStatus, setQueueStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([fetchFlows(), fetchAutomationStats()]);
      setFlows(f);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetchQueue({ status: queueStatus || undefined, limit: 50 });
      setMsgs(res.messages);
      setQueueTotal(res.total);
    } finally {
      setQueueLoading(false);
    }
  }, [queueStatus]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleToggle = async (flow: AutomationFlow) => {
    await toggleFlow(flow.id, !flow.is_active);
    await loadAll();
  };

  return (
    <div className="p-8 max-w-screen-lg">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="text-gray-500 text-sm mt-0.5">Follow-up flows triggered by lead behavior</p>
        </div>
        <button onClick={() => { loadAll(); loadQueue(); }} className="btn-secondary">
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard label="Active Flows" value={stats.active_flows} icon={Zap} color="bg-primary-600" />
          <StatCard label="Pending" value={stats.messages_pending} icon={Clock} color="bg-amber-500" />
          <StatCard label="Sent" value={stats.messages_sent} icon={Send} color="bg-green-600" />
          <StatCard label="Failed" value={stats.messages_failed} icon={AlertCircle} color="bg-red-500" />
        </div>
      )}

      {/* Flow Cards */}
      <h2 className="text-base font-semibold text-gray-800 mb-4">Automation Flows</h2>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 h-20 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {flows.map((flow) => (
            <FlowCard key={flow.id} flow={flow} onToggle={() => handleToggle(flow)} />
          ))}
        </div>
      )}

      {/* How triggers work */}
      <div className="card p-5 mb-8 bg-blue-50 border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" /> How triggers fire
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-blue-700">
          <p><strong>Lead Captured</strong> — phone or email extracted from chat</p>
          <p><strong>Hot Lead</strong> — intent score crosses 7.0</p>
          <p><strong>Post Purchase</strong> — stage changes to CUSTOMER</p>
          <p><strong>No Reply 24h</strong> — Celery checks every 30 min</p>
        </div>
        <p className="text-xs text-blue-500 mt-2">
          ⚡ Celery worker + beat must be running for scheduled delivery.
          On Railway: the <code className="bg-blue-100 px-1 rounded">worker</code> process in the Procfile handles this.
        </p>
      </div>

      {/* Message Queue */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">
          Message Queue <span className="text-gray-400 font-normal text-sm">({queueTotal} total)</span>
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="input !w-auto text-sm"
            value={queueStatus}
            onChange={(e) => setQueueStatus(e.target.value)}
          >
            {QUEUE_STATUSES.map((s) => (
              <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "All Statuses"}</option>
            ))}
          </select>
        </div>
      </div>
      <QueueTable msgs={msgs} loading={queueLoading} />
    </div>
  );
}
