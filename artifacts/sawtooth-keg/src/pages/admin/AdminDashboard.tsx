import { Link } from "wouter";
import { useGetDashboardSummary, useGetRecentOrders, getGetDashboardSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, CheckCircle, Clock, DollarSign, CalendarDays, TrendingUp } from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-stone-100 text-stone-500",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-stone-100 text-stone-600"}`}>
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const recentOrders = useGetRecentOrders({ limit: 8 }, { query: { queryKey: getGetRecentOrdersQueryKey({ limit: 8 }) } });

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl">
        <h1 className="text-2xl font-bold font-serif mb-6" data-testid="heading-dashboard">Dashboard</h1>

        {summary.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : summary.data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card data-testid="stat-total-orders">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-3xl font-bold">{summary.data.totalOrders}</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-pending-orders">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-3xl font-bold text-amber-600">{summary.data.pendingOrders}</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-today-pickups">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Today's Pickups</span>
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-blue-600">{summary.data.todayPickups}</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-revenue">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Revenue</span>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-green-600">${Number(summary.data.totalRevenue).toFixed(0)}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : recentOrders.data && recentOrders.data.length > 0 ? (
              <table className="w-full text-sm" data-testid="table-recent-orders">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Beer</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pickup</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.data.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-order-${order.id}`}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${order.id}`} className="font-medium hover:text-primary transition-colors">
                          {order.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{order.beerName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{order.pickupDate}</td>
                      <td className="px-4 py-3">{statusBadge(order.status)}</td>
                      <td className="px-4 py-3 text-right">${Number(order.totalAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-muted-foreground">No orders yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
