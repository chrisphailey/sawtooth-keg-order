import React from "react";
import { Link } from "wouter";
import { Show, useAuth, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <nav className="border-b bg-background sticky top-0 z-10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img src={`${basePath}/logo.png`} alt="Sawtooth Brewery Logo" className="h-9 w-auto" />
          <span className="font-bold text-xl text-primary font-serif tracking-tight">Sawtooth Brewery</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <Link href="/keg-order" className="text-sm font-medium hover:text-primary transition-colors">
              Order a Keg
            </Link>
            <Link href="/sign-in" className="text-sm font-medium">
              <Button variant="outline" size="sm" data-testid="link-signin">Staff Sign In</Button>
            </Link>
          </Show>
          
          <Show when="signed-in">
            <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut({ redirectUrl: "/" })} data-testid="button-signout">
              Sign Out
            </Button>
          </Show>
        </div>
      </div>
    </nav>
  );
}
