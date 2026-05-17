import { useEffect, useState, useCallback } from "react";
import { Megaphone, Send, RefreshCw, Plus, CheckCircle, XCircle, Loader } from "lucide-react";
import clsx from "clsx";
import { fetchBroadcasts, createBroadcast, sendBroadcast, Broadcast } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const CHANNELS = ["all", "telegram", "whatsapp", "facebook", "instagram"];
const STAGES = ["", "NEW", "LEAD", "HOT_LEAD", "CUSTOMER", "REPEAT_CUSTOMER"];
const PERSONAS = ["", "price_sensitive", "trust_seeker", "fast_buyer", "ready_to_buy", "general"];

// ─── New Broadcast Modal ──────────────────────────────────────────────────────

function NewBroadcastModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    message: "",
    channel: "all",
    target_stage: "",
    target_persona: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      setError("Name and message are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createBroadcast({
        ...form,
        target_stage: form.target_stage || undefined,
        target_persona: form.target_persona || undefined,
      });
      onCreated();
      onClose();
    } catch {
      setError("Failed to create broadcast.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">New Broadcast</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Campaign Name</label>
            <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Eid Promo 2025" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea className="input w-full h-28 resize-none" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Hi {name}! We have a special offer..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
              <select className="input w-full text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c === "all" ? "All Channels" : c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Stage</label>
              <select className="input w-full text-sm" value={form.target_stage} onChange={(e) => setForm({ ...form, target_stage: e.target.value })}>
                {STAGES.map((s) => <option key={s} value={s}>{s || "All Stages"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Persona</label>
              <select className="input w-full text-sm" value={form.target_persona} onChange={(e) => setForm({ ...form, target_persona: e.target.value })}>
                {PERSONAS.map((p) => <option key={p} value={p}>{p ? p.replace("_", " ") : "All Personas"}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create Broadcast"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Broadcast Card ───────────────────────────────────────────────────────────

function BroadcastCard({ broadcast, onSend }: { broadcast: Broadcast; onSend: () => void }) {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await sendBroadcast(broadcast.id);
      onSend();
    } catch {
      // error handled in service
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{broadcast.name}</p>
            <span className={clsx("flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium", STATUS_COLORS[broadcast.status])}>
              {broadcast.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{broadcast.message}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>📡 {broadcast.channel}</span>
            {broadcast.target_stage && <span>Stage: {broadcast.target_stage}</span>}
            {broadcast.target_persona && <span>Persona: {broadcast.target_persona.replace("_", " ")}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {broadcast.status === "sent" && (
            <div className="text-xs text-gray-500 mb-2">
              <p className="text-green-600 font-medium">✓ {broadcast.sent_count} sent</p>
              {broadcast.failed_count > 0 && <p className="text-red-500">{broadcast.failed_count} failed</p>}
            </div>
          )}
          {broadcast.status === "draft" && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
            >
              {sending ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {sending ? "Sending…" : "Send Now"}
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-300 mt-3">{new Date(broadcast.created_at).toLocaleString()}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBroadcasts({ limit: 50 });
      setBroadcasts(res.broadcasts);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="p-8 max-w-screen-lg">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-gray-500 text-sm mt-0.5">Send bulk messages to segmented leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="btn-secondary">
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} /> Refresh
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Broadcast
          </button>
        </div>
      </div>

      <div className="card p-5 mb-8 bg-blue-50 border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Megaphone className="w-4 h-4" /> How broadcasts work
        </h3>
        <div className="text-xs text-blue-700 space-y-1">
          <p>1. Create a broadcast with your message and target audience (stage/persona/channel)</p>
          <p>2. Click <strong>Send Now</strong> to dispatch immediately to all matching leads</p>
          <p>3. Only leads on channels that support push delivery (Telegram, WhatsApp, Facebook, Instagram) will receive it</p>
          <p>4. Website channel leads <em>cannot</em> receive broadcasts — they require an active session</p>
        </div>
      </div>

      <h2 className="text-base font-semibold text-gray-800 mb-4">
        All Broadcasts <span className="text-gray-400 font-normal text-sm">({total} total)</span>
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="card p-5 h-32 animate-pulse bg-gray-50" />)}
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          No broadcasts yet. Create one above to send a message to your leads.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {broadcasts.map((b) => <BroadcastCard key={b.id} broadcast={b} onSend={loadAll} />)}
        </div>
      )}

      {showModal && <NewBroadcastModal onClose={() => setShowModal(false)} onCreated={loadAll} />}
    </div>
  );
}
