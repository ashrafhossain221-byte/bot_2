import { useEffect, useState, useCallback } from "react";
import {
  ShoppingCart, Package, Truck, CheckCircle, XCircle,
  Clock, RefreshCw, ChevronDown, ChevronRight, Plus,
} from "lucide-react";
import clsx from "clsx";
import { fetchOrders, fetchOrderStats, updateOrderStatus, OrderItem as OrderItemType, Order, OrderStats } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_FLOW = ["new", "confirmed", "processing", "dispatched", "delivered", "cancelled"];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  processing: "bg-amber-100 text-amber-700",
  dispatched: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  new: <Clock className="w-3.5 h-3.5" />,
  confirmed: <CheckCircle className="w-3.5 h-3.5" />,
  processing: <Package className="w-3.5 h-3.5" />,
  dispatched: <Truck className="w-3.5 h-3.5" />,
  delivered: <CheckCircle className="w-3.5 h-3.5 text-green-600" />,
  cancelled: <XCircle className="w-3.5 h-3.5" />,
};

function formatCurrency(amount: number, currency = "BDT") {
  return `${currency} ${amount.toLocaleString()}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
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

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onStatusChange }: { order: Order; onStatusChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];

  const handleAdvance = async () => {
    if (!nextStatus || nextStatus === "cancelled") return;
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, nextStatus);
      onStatusChange();
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (order.status === "cancelled" || order.status === "delivered") return;
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, "cancelled");
      onStatusChange();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="card overflow-hidden mb-3">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-gray-400">Customer</p>
            <p className="text-sm font-medium text-gray-900 truncate">{order.customer_name || "—"}</p>
            <p className="text-xs text-gray-400">{order.customer_phone || ""}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Amount</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount, order.currency)}</p>
            <p className="text-xs text-gray-400">{order.payment_method || "—"} · {order.payment_status}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Channel</p>
            <p className="text-sm text-gray-700 capitalize">{order.channel}</p>
            <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <span className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", STATUS_COLORS[order.status])}>
              {STATUS_ICONS[order.status]}
              {order.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {nextStatus && nextStatus !== "cancelled" && (
            <button
              onClick={handleAdvance}
              disabled={updating}
              className="btn-primary text-xs px-3 py-1.5"
            >
              → {nextStatus}
            </button>
          )}
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <button
              onClick={handleCancel}
              disabled={updating}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 px-2 py-1.5"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">ORDER ITEMS</p>
          <div className="space-y-1 mb-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {item.product_name}
                  {item.variant && <span className="text-gray-400 ml-1 text-xs">{JSON.stringify(item.variant)}</span>}
                  <span className="text-gray-400 ml-1">×{item.quantity}</span>
                </span>
                <span className="font-medium">{formatCurrency(item.subtotal, order.currency)}</span>
              </div>
            ))}
          </div>
          {order.customer_address && (
            <p className="text-xs text-gray-500"><strong>Address:</strong> {order.customer_address}</p>
          )}
          {order.notes && (
            <p className="text-xs text-gray-500 mt-1"><strong>Notes:</strong> {order.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["", ...STATUS_FLOW];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        fetchOrders({ status: statusFilter || undefined, limit: 50 }),
        fetchOrderStats(),
      ]);
      setOrders(res.orders);
      setTotal(res.total);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="p-8 max-w-screen-lg">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage customer orders across all channels</p>
        </div>
        <button onClick={loadAll} className="btn-secondary">
          <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Orders" value={stats.total} icon={ShoppingCart} color="bg-primary-600" />
          <StatCard label="New" value={stats.by_status.new || 0} icon={Clock} color="bg-blue-500" />
          <StatCard label="Dispatched" value={stats.by_status.dispatched || 0} icon={Truck} color="bg-orange-500" />
          <StatCard label="Revenue" value={`৳${(stats.revenue || 0).toLocaleString()}`} icon={CheckCircle} color="bg-green-600" />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">
          Orders <span className="text-gray-400 font-normal text-sm">({total} total)</span>
        </h2>
        <select
          className="input !w-auto text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "All Statuses"}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 h-16 animate-pulse bg-gray-50" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          No orders yet. Orders appear here when customers place them via chat or manually.
        </div>
      ) : (
        orders.map((o) => <OrderRow key={o.id} order={o} onStatusChange={loadAll} />)
      )}
    </div>
  );
}
