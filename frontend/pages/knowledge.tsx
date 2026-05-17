import { useEffect, useState, useCallback, useRef } from "react";
import {
  BookOpen, Upload, Plus, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, Search, FileText, X, Check, ChevronDown, ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchKnowledgeDocs, uploadKnowledgeDoc, addKnowledgeText,
  deleteKnowledgeDoc, toggleKnowledgeDoc, searchKnowledge,
  KnowledgeDoc,
} from "@/lib/api";

// ─── Add Text Modal ───────────────────────────────────────────────────────────

function AddTextModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError("Title and content are required."); return; }
    setSaving(true);
    try {
      await addKnowledgeText({ title, content });
      onAdded();
      onClose();
    } catch { setError("Failed to add text."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Text Content</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Return Policy, FAQ, About Us" />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea
              className="input h-40 resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your content here. It will be chunked and indexed for the AI to use when answering questions..."
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Indexing…" : "Add to Knowledge Base"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RAG Test Modal ────────────────────────────────────────────────────────────

function RagTestModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchKnowledge(query);
      setResults(res.results);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Test RAG Retrieval</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Type a question to see which knowledge chunks the AI would use to answer it.
        </p>
        <div className="flex gap-2 mb-5">
          <input
            className="input flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. What is your return policy?"
          />
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
        {results.length === 0 && !loading && (
          <p className="text-center text-gray-400 text-sm py-4">
            {query ? "No matching chunks found — try a different query." : "Enter a query above to test."}
          </p>
        )}
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-primary-700">{r.doc_title}</span>
                <span className="text-xs text-gray-400 tabular-nums">score {r.score}</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{r.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Doc Card ─────────────────────────────────────────────────────────────────

function DocCard({ doc, onDelete, onToggle }: {
  doc: KnowledgeDoc;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggle(); } finally { setToggling(false); }
  };

  const FILE_TYPE_ICONS: Record<string, string> = {
    pdf: "📄", docx: "📝", txt: "📃", csv: "📊", manual: "✍️", url: "🔗",
  };

  return (
    <div className={clsx("card p-4 flex items-start gap-3", !doc.is_active && "opacity-50")}>
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-lg">
        {FILE_TYPE_ICONS[doc.file_type] ?? "📄"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
          <span>{doc.chunk_count} chunks</span>
          <span>~{doc.token_estimate.toLocaleString()} tokens</span>
          {doc.embed_model && <span className="text-blue-400">{doc.embed_model}</span>}
          {doc.source_name && <span className="truncate max-w-[120px]">{doc.source_name}</span>}
        </div>
        {doc.content_preview && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.content_preview}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={doc.is_active ? "Deactivate" : "Activate"}
          className="text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-40"
        >
          {doc.is_active
            ? <ToggleRight className="w-6 h-6 text-primary-600" />
            : <ToggleLeft className="w-6 h-6" />
          }
        </button>
        {confirmDelete ? (
          <>
            <button onClick={onDelete} className="p-1.5 text-red-600 hover:text-red-800" title="Confirm">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setConfirmDelete(false)} className="p-1.5 text-gray-400 hover:text-gray-600" title="Cancel">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchKnowledgeDocs();
      setDocs(res.documents);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadKnowledgeDoc(file);
      loadAll();
    } catch { alert("Upload failed. Check the file format (PDF, DOCX, TXT)."); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await deleteKnowledgeDoc(id);
    loadAll();
  };

  const handleToggle = async (doc: KnowledgeDoc) => {
    await toggleKnowledgeDoc(doc.id, !doc.is_active);
    loadAll();
  };

  return (
    <div className="p-8 max-w-screen-lg">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {total} document{total !== 1 ? "s" : ""} — the AI uses these to answer questions accurately (RAG)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadAll} className="btn-secondary">
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowTestModal(true)} className="btn-secondary">
            <Search className="w-4 h-4" /> Test RAG
          </button>
          <button onClick={() => setShowTextModal(true)} className="btn-secondary">
            <Plus className="w-4 h-4" /> Add Text
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.csv,.doc" className="hidden" onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary">
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Indexing…" : "Upload File"}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5 mb-7 bg-blue-50 border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> How RAG works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-blue-700">
          <p>📤 <strong>Upload</strong> — PDF, DOCX, or TXT files are automatically chunked into ~400-token segments</p>
          <p>🧠 <strong>Embed</strong> — Each chunk is embedded using sentence-transformers (or your AI provider's /embeddings endpoint)</p>
          <p>🔍 <strong>Retrieve</strong> — On every chat message, the top matching chunks are injected into the AI's context</p>
        </div>
        <p className="text-xs text-blue-500 mt-2">
          Great for: FAQ docs, product manuals, return policies, pricing sheets, company info, support articles.
        </p>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-50" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No documents yet</p>
          <p className="text-gray-400 text-sm mt-1">Upload a PDF or add text content to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              onDelete={() => handleDelete(doc.id)}
              onToggle={() => handleToggle(doc)}
            />
          ))}
        </div>
      )}

      {showTextModal && <AddTextModal onClose={() => setShowTextModal(false)} onAdded={loadAll} />}
      {showTestModal && <RagTestModal onClose={() => setShowTestModal(false)} />}
    </div>
  );
}
