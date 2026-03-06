"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CreditsBadge } from "./credits-badge";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
        <span className="text-lg font-semibold">AI Clothing</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user && <CreditsBadge credits={user.free_credits_remaining} />}
          <Button asChild variant="ghost" size="icon">
            <Link href="/profile">
              <User className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
