import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Beer, 
  ClipboardList, 
  CalendarDays,
  LogOut
} from "lucide-react";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/beers", label: "Keg Inventory", icon: Beer },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="flex flex-col w-64 border-r bg-sidebar h-full text-sidebar-foreground">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2">
          <img src={`${basePath}/logo.svg`} alt="Logo" className="h-6 w-6" />
          <span className="font-bold text-lg font-serif">Sawtooth Admin</span>
        </Link>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/admin");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground" 
          onClick={() => signOut({ redirectUrl: "/" })}
          data-testid="button-admin-signout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
