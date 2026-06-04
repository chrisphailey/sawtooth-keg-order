import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <nav className="border-b bg-background sticky top-0 z-10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img src={`${basePath}/logo.png`} alt="Sawtooth Brewery Logo" className="h-9 w-auto" />
          <span className="font-bold text-xl text-primary font-serif tracking-tight">Sawtooth Brewery</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link href="/keg-order" className="text-sm font-medium hover:text-primary transition-colors">
            Order a Keg
          </Link>
          <Link href="/admin" className="text-sm font-medium">
            <Button variant="outline" size="sm" data-testid="link-admin">Staff Access</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
