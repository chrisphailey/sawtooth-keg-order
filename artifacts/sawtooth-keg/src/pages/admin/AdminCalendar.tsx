import { useState } from "react";
import { useLocation } from "wouter";
import { useListPickups, getListPickupsQueryKey } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [, setLocation] = useLocation();

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const pickups = useListPickups(
    { startDate, endDate },
    { query: { queryKey: getListPickupsQueryKey({ startDate, endDate }) } }
  );

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPadding = getDay(startOfMonth(currentMonth));

  const getPickupsForDay = (day: Date) => {
    if (!pickups.data) return [];
    return pickups.data.filter((p) => {
      try { return isSameDay(parseISO(p.pickupDate), day); }
      catch { return false; }
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-serif" data-testid="heading-calendar">Pickup Calendar</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold min-w-[140px] text-center" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} data-testid="button-today">
              Today
            </Button>
          </div>
        </div>

        {pickups.isLoading ? (
          <Skeleton className="h-[500px] rounded-xl" />
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-muted/30">
              {DAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="border-r border-b min-h-[100px] bg-muted/10" />
              ))}
              {days.map((day) => {
                const dayPickups = getPickupsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`border-r border-b min-h-[100px] p-1.5 ${!isCurrentMonth ? "bg-muted/20" : ""}`}
                    data-testid={`day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isCurrentDay ? "bg-primary text-primary-foreground" : "text-foreground"
                    }`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayPickups.slice(0, 3).map((pickup) => (
                        <button
                          key={pickup.id}
                          onClick={() => setLocation(`/admin/orders/${pickup.orderId}`)}
                          className="w-full text-left px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium truncate transition-colors"
                          data-testid={`event-pickup-${pickup.id}`}
                        >
                          {pickup.pickupTime} {pickup.customerName}
                        </button>
                      ))}
                      {dayPickups.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{dayPickups.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
