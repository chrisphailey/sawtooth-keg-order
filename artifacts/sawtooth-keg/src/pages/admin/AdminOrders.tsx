import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrders,
  useConfirmOrder,
  useCancelOrder,
  useReturnOrder,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Loader2, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-stone-100 text-stone-500",
};
const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-stone-100 text-stone-600",
  authorized: "bg-amber-100 text-amber-800",
  captured: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-purple-100 text-purple-800",
};

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = statusFilter !== "all" ? { status: statusFilter } : undefined;
  const orders = useListOrders(params, { query: { queryKey: getListOrdersQueryKey(params) } });
  const confirmOrder = useConfirmOrder();
  const cancelOrder = useCancelOrder();
  const returnOrder = useReturnOrder();

  const filteredOrders = useMemo(() => {
    if (!orders.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return orders.data;
    return orders.data.filter((o) =>
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      o.beerName.toLowerCase().includes(q) ||
      o.pickupDate.includes(q) ||
      String(o.id).includes(q)
    );
  }, [orders.data, search]);

  const handleConfirm = (id: number) => {
    setConfirmingId(id);
    confirmOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order confirmed", description: "Payment has been captured." });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Failed to confirm order";
        toast({ title: "Confirmation failed", description: msg, variant: "destructive" });
      },
      onSettled: () => setConfirmingId(null),
    });
  };

  const handleCancel = (id: number) => {
    if (!confirm("Cancel this order?")) return;
    cancelOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order cancelled" });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
    });
  };

  const handleReturn = (id: number, depositAmount: number) => {
    if (!confirm(`Mark keg as returned and refund the $${depositAmount.toFixed(2)} deposit?`)) return;
    setReturningId(id);
    returnOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Keg returned", description: `$${depositAmount.toFixed(2)} deposit has been refunded.` });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Failed to process return";
        toast({ title: "Return failed", description: msg, variant: "destructive" });
      },
      onSettled: () => setReturningId(null),
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl">
        <h1 className="text-2xl font-bold font-serif mb-6" data-testid="heading-orders">Orders</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList data-testid="tabs-status-filter">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
              <TabsTrigger value="confirmed" data-testid="tab-confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled" data-testid="tab-cancelled">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative sm:ml-auto sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, email, beer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              data-testid="input-search"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {orders.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-orders">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Beer</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pickup</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Payment</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-order-${order.id}`}>
                        <td className="px-4 py-3 text-muted-foreground">#{order.id}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/orders/${order.id}`} className="font-medium hover:text-primary transition-colors">
                            {order.customerName}
                          </Link>
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          {order.items && order.items.length > 1 ? (
                            <>
                              <div>Multiple kegs</div>
                              <div className="text-xs text-muted-foreground">{order.quantity} total</div>
                            </>
                          ) : (
                            <>
                              <div>{order.beerName}</div>
                              <div className="text-xs text-muted-foreground">{order.kegSize} × {order.quantity}</div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.pickupDate}<br/>
                          <span className="text-xs">{order.pickupTime}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status] ?? ""}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_COLORS[order.paymentStatus] ?? ""}`}>
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">${Number(order.totalAmount).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {order.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={confirmingId === order.id}
                                onClick={() => handleConfirm(order.id)}
                                data-testid={`button-confirm-${order.id}`}
                              >
                                {confirmingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Confirm
                              </Button>
                            )}
                            {order.status === "confirmed" && order.paymentStatus === "captured" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-purple-700 border-purple-300 hover:bg-purple-50"
                                disabled={returningId === order.id}
                                onClick={() => handleReturn(order.id, Number(order.depositAmount))}
                                data-testid={`button-return-${order.id}`}
                              >
                                {returningId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                Return Keg & Refund
                              </Button>
                            )}
                            {order.status === "completed" && order.paymentStatus === "refunded" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                <RotateCcw className="h-3 w-3" /> Deposit Refunded
                              </span>
                            )}
                            {(order.status === "pending" || order.status === "confirmed") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleCancel(order.id)}
                                data-testid={`button-cancel-${order.id}`}
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center text-muted-foreground">
                {search.trim() ? `No orders match "${search.trim()}".` : "No orders found."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
