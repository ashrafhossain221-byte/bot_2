import { useEffect, useState, useCallback } from "react";
import {
  MessageCircle, CheckCircle, RefreshCw, Send, X, Filter,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchComments, fetchCommentStats, replyToComment, markCommentHandled,
  CommentEvent, CommentStats,
} from "@/lib/api";

// ─── Reply Modal ──────────────────────────────────────────────────────────────

function ReplyModal({
  comment,
  onClose,
  onReplied,
}: {
  comment: CommentEvent;
  onClose: () => void;
  onReplied: () => void;
}) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"dm" | "comment">("dm");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      await replyToComment(comment.id, message, mode);
      onReplied();
      onClose();
    } catch { setError("Failed to send reply. Check channel credentials in Settings."); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Reply to Comment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium",
              comment.platform === "facebook" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
            )}>
              {comment.platform}
            </span>
            <span className="text-xs font-medium text-gray-700">{comment.user_name || comment.user_id}</span>
          </div>
          <p className="text-sm text-gray-600">{comment.content}</p>
        </div>

        <div className="mb-4">
          <label className="label">Reply via</label>
          <div className="flex gap-2">
            {(["dm", "comment"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  mode === m ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {m === "dm" ? "📩 Private DM" : "💬 Public Comment"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Message</label>
          <textarea
            className="input h-24 resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your reply…"
            autoFocus
          />
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSend} disabled={sending || !message.trim()} className="btn-primary">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : "Send Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Comment Row ──────────────────────────────────────────────────────────────

function CommentRow({ comment, onAction }: { comment: CommentEvent; onAction: () => void }) {
  const [replyOpen, setReplyOpen] = useState(false);

  const handleMarkHandled = async () => {
    await markCommentHandled(comment.id);
    onAction();
  };

  return (
    <>
      <tr className={clsx("hover:bg-gray-50 transition-colors", comment.handled && "opacity-60")}>
        <td className="px-4 py-3">
          <span className={clsx(
            "px-2 py-0.5 rounded-full text-[10px] font-medium",
            comment.platform === "facebook" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
          )}>
            {comment.platform}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="text-xs font-medium text-gray-700">{comment.user_name || comment.user_id}</p>
        </td>
        <td className="px-4 py-3 max-w-sm">
          <p className="text-xs text-gray-700 truncate" title={comment.content}>{comment.content}</p>
          {comment.reply_message && (
            <p className="text-[10px] text-green-600 mt-0.5 truncate">↳ {comment.reply_message}</p>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
          {new Date(comment.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </td>
        <td className="px-4 py-3">
          {comment.handled ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Handled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Pending
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {!comment.handled && (
              <>
                <button
                  onClick={() => setReplyOpen(true)}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  Reply
                </button>
                <button
                  onClick={handleMarkHandled}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Mark Handled
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {replyOpen && (
        <ReplyModal
          comment={comment}
          onClose={() => setReplyOpen(false)}
          onReplied={onAction}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommentsPage() {
  const [comments, setComments] = useState<CommentEvent[]>([]);
  const [stats, setStats] = useState<CommentStats | null>(null);
  const [total, setTotal] = useState(0);
  const [platform, setPlatform] = useState("");
  const [handledFilter, setHandledFilter] = useState<"" | "true" | "false">("");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        fetchComments({
          platform: platform || undefined,
          handled: handledFilter === "" ? undefined : handledFilter === "true",
          limit: 100,
        }),
        fetchCommentStats(),
      ]);
      setComments(res.comments);
      setTotal(res.total);
      setStats(s);
    } finally { setLoading(false); }
  }, [platform, handledFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="p-8 max-w-screen-xl">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comment Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">Facebook & Instagram comment inbox</p>
        </div>
        <button onClick={loadAll} className="btn-secondary">
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Comments</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.unhandled}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.auto_replied}</p>
            <p className="text-xs text-gray-500">Auto-Replied</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.by_platform.facebook ?? 0}</p>
            <p className="text-xs text-gray-500">Facebook · {stats.by_platform.instagram ?? 0} Instagram</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <Filter className="w-4 h-4 text-gray-400" />
        <select className="input !w-auto text-sm" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
        </select>
        <select className="input !w-auto text-sm" value={handledFilter} onChange={(e) => setHandledFilter(e.target.value as any)}>
          <option value="">All Status</option>
          <option value="false">Pending</option>
          <option value="true">Handled</option>
        </select>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Platform</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Comment</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    No comments yet. They appear here when Facebook/Instagram webhooks fire.
                  </td>
                </tr>
              ) : (
                comments.map((c) => <CommentRow key={c.id} comment={c} onAction={loadAll} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
