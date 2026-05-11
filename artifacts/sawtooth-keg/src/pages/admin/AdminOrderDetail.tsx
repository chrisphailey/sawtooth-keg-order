import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrder,
  useConfirmOrder,
  useCancelOrder,
  getGetOrderQueryKey,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle, XCircle, FileText, Printer, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-stone-100 text-stone-500",
};

export default function AdminOrderDetail() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const order = useGetOrder(orderId, { query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) } });
  const confirmOrder = useConfirmOrder();
  const cancelOrder = useCancelOrder();

  const handleConfirm = () => {
    setIsConfirming(true);
    confirmOrder.mutate({ id: orderId }, {
      onSuccess: () => {
        toast({ title: "Order confirmed", description: "Payment captured successfully." });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Payment capture failed";
        toast({ title: "Confirmation failed", description: msg, variant: "destructive" });
      },
      onSettled: () => setIsConfirming(false),
    });
  };

  const handleCancel = () => {
    if (!confirm("Cancel this order?")) return;
    cancelOrder.mutate({ id: orderId }, {
      onSuccess: () => {
        toast({ title: "Order cancelled" });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl">
        <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors" data-testid="link-back-orders">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>

        {order.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : !order.data ? (
          <div className="text-muted-foreground">Order not found.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-2xl font-bold font-serif" data-testid="heading-order-detail">Order #{order.data.id}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded text-sm font-medium ${STATUS_COLORS[order.data.status] ?? ""}`}>
                {order.data.status}
              </span>
            </div>

            {order.data.paymentError && (
              <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-2 text-sm text-destructive" data-testid="alert-payment-error">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Payment error: {order.data.paymentError}</span>
              </div>
            )}

            {/* Idaho State Police form banner — always visible */}
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="banner-isp-form">
              <div>
                <p className="text-sm font-semibold text-amber-900">Idaho State Police Keg Receipt</p>
                <p className="text-xs text-amber-700 mt-0.5">Required for all keg sales — complete at time of pickup</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/pickup/${orderId}/forms`}>
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100" data-testid="link-isp-form">
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Fill Out
                  </Button>
                </Link>
                <Link href={`/pickup/${orderId}/receipt`}>
                  <Button size="sm" variant="ghost" className="text-amber-900 hover:bg-amber-100" data-testid="link-isp-receipt">
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground block">Name</span>{order.data.customerName}</div>
                  <div><span className="text-muted-foreground block">Email</span>{order.data.customerEmail}</div>
                  <div><span className="text-muted-foreground block">Phone</span>{order.data.customerPhone}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Order Details</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-3">
                  {order.data.items && order.data.items.length > 0 ? (
                    <div>
                      <span className="text-muted-foreground block mb-2">Keg Line Items</span>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                              <th className="text-left px-3 py-2 font-medium">Beer</th>
                              <th className="text-left px-3 py-2 font-medium">Keg Size</th>
                              <th className="text-right px-3 py-2 font-medium">Qty</th>
                              <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.data.items.map((item) => (
                              <tr key={item.id} className="border-t border-border/50">
                                <td className="px-3 py-2">{item.beerName}</td>
                                <td className="px-3 py-2">{item.kegSize}</td>
                                <td className="px-3 py-2 text-right">{item.quantity}</td>
                                <td className="px-3 py-2 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="text-muted-foreground block">Beer</span>{order.data.beerName}</div>
                      <div><span className="text-muted-foreground block">Keg Size</span>{order.data.kegSize}</div>
                      <div><span className="text-muted-foreground block">Quantity</span>{order.data.quantity}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground block">Deposit</span>${Number(order.data.depositAmount).toFixed(2)}</div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground block">Pouring Method</span>
                      {order.data.pouringMethod}
                    </div>
                    {Number(order.data.rentalFee) > 0 && (
                      <div><span className="text-muted-foreground block">Rental Fee</span>${Number(order.data.rentalFee).toFixed(2)}</div>
                    )}
                    {order.data.notes && <div className="col-span-2"><span className="text-muted-foreground block">Notes</span>{order.data.notes}</div>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Pickup</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground block">Date</span>{order.data.pickupDate}</div>
                  <div><span className="text-muted-foreground block">Time</span>{order.data.pickupTime}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Status</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mt-0.5 ${
                      order.data.paymentStatus === "captured" ? "bg-green-100 text-green-800" :
                      order.data.paymentStatus === "authorized" ? "bg-amber-100 text-amber-800" :
                      order.data.paymentStatus === "failed" ? "bg-red-100 text-red-800" :
                      "bg-stone-100 text-stone-600"
                    }`}>{order.data.paymentStatus}</span>
                  </div>
                  <div><span className="text-muted-foreground block">Total</span>${Number(order.data.totalAmount).toFixed(2)}</div>
                  {order.data.cloverPaymentId && (
                    <div className="col-span-2"><span className="text-muted-foreground block">Payment ID</span><code className="text-xs">{order.data.cloverPaymentId}</code></div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Separator className="my-6" />

            <div className="flex flex-wrap gap-3">
              {order.data.status === "pending" && (
                <Button onClick={handleConfirm} disabled={isConfirming} data-testid="button-confirm-order">
                  {isConfirming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Confirm & Capture Payment
                </Button>
              )}
              {(order.data.status === "pending" || order.data.status === "confirmed") && (
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleCancel} data-testid="button-cancel-order">
                  <XCircle className="h-4 w-4 mr-2" /> Cancel Order
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
