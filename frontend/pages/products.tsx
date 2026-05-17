import { useEffect, useState, useCallback } from "react";
import {
  Package, Plus, Search, RefreshCw, Edit2, Trash2, X, Check,
} from "lucide-react";
import clsx from "clsx";
import {
  fetchProducts, createProduct, updateProduct, deleteProduct,
  Product, ProductCreate,
} from "@/lib/api";

// ─── Product Form Modal ───────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  price: string;
  currency: string;
  stock: string;
  sku: string;
  category: string;
  is_active: boolean;
  keywords: string; // comma-separated
}

const EMPTY_FORM: FormState = {
  name: "", description: "", price: "", currency: "BDT",
  stock: "", sku: "", category: "", is_active: true, keywords: "",
};

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description || "",
    price: String(p.price),
    currency: p.currency,
    stock: String(p.stock),
    sku: p.sku || "",
    category: p.category || "",
    is_active: p.is_active,
    keywords: (p.keywords || []).join(", "),
  };
}

function formToCreate(f: FormState): ProductCreate {
  return {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    price: parseFloat(f.price) || 0,
    currency: f.currency,
    stock: parseInt(f.stock) || 0,
    sku: f.sku.trim() || undefined,
    category: f.category.trim() || undefined,
    is_active: f.is_active,
    keywords: f.keywords ? f.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
  };
}

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(product ? productToForm(product) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Product name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const data = formToCreate(form);
      if (product) {
        await updateProduct(product.id, data);
      } else {
        await createProduct(data);
      }
      onSaved();
      onClose();
    } catch {
      setError("Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {product ? "Edit Product" : "Add Product"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Product Name *</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Premium Cotton T-Shirt" />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input h-20 resize-none" value={form.description} onChange={set("description")} placeholder="Short product description…" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Price</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={set("price")} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={set("currency")}>
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <div>
              <label className="label">Stock</label>
              <input className="input" type="number" min="0" value={form.stock} onChange={set("stock")} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">SKU</label>
              <input className="input" value={form.sku} onChange={set("sku")} placeholder="SKU-001" />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={set("category")} placeholder="Clothing, Electronics…" />
            </div>
          </div>

          <div>
            <label className="label">Keywords <span className="text-gray-400 font-normal">(comma-separated, for chat matching)</span></label>
            <input className="input" value={form.keywords} onChange={set("keywords")} placeholder="shirt, cotton, casual, summer" />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-primary-600"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active (visible in catalog)</label>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : product ? "Save Changes" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={clsx("card p-4 flex items-start gap-4", !product.is_active && "opacity-60")}>
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Package className="w-5 h-5 text-gray-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
          {!product.is_active && (
            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">INACTIVE</span>
          )}
          {product.stock === 0 && (
            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium">OUT OF STOCK</span>
          )}
        </div>
        {product.description && (
          <p className="text-xs text-gray-500 truncate mb-1">{product.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="font-bold text-gray-900 text-sm">{product.currency} {product.price.toLocaleString()}</span>
          <span>Stock: {product.stock}</span>
          {product.category && <span>📂 {product.category}</span>}
          {product.sku && <span>SKU: {product.sku}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors" title="Edit">
          <Edit2 className="w-4 h-4" />
        </button>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="p-1.5 text-red-600 hover:text-red-800" title="Confirm delete">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setConfirming(false)} className="p-1.5 text-gray-400 hover:text-gray-600" title="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalProduct, setModalProduct] = useState<Product | null | "new">(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProducts({ search: search || undefined, active_only: false });
      setProducts(res.products);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadAll, 300);
    return () => clearTimeout(t);
  }, [loadAll]);

  const handleDelete = async (id: string) => {
    await deleteProduct(id);
    loadAll();
  };

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  return (
    <div className="p-8 max-w-screen-lg">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {total} product{total !== 1 ? "s" : ""} — the AI uses this catalog to answer pricing questions
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="btn-secondary">
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => setModalProduct("new")} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search products by name, category, or keyword…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Info banner */}
      <div className="card p-4 mb-6 bg-blue-50 border-blue-100 text-xs text-blue-700">
        <strong>How it works:</strong> When a customer asks about a product in chat, the bot automatically
        searches this catalog and injects matching products into its context — so it can answer price,
        stock, and variant questions accurately across all channels.
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSearch(cat!)}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 h-16 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {search ? `No products matching "${search}"` : "No products yet. Add your first product above."}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => setModalProduct(p)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalProduct !== null && (
        <ProductModal
          product={modalProduct === "new" ? null : modalProduct}
          onClose={() => setModalProduct(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
