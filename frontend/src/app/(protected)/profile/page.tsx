"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setShopName(user.shop_name ?? "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const body: Record<string, string> = {};
      if (name !== (user?.name ?? "")) body.name = name;
      if (shopName !== (user?.shop_name ?? "")) body.shop_name = shopName;

      if (Object.keys(body).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      await apiFetch("/api/user/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await refreshUser();
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Profile</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="shopName" className="text-sm font-medium">
                Shop Name
              </label>
              <Input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Your shop name"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Phone</p>
              <p className="text-sm text-muted-foreground">{user?.phone}</p>
            </div>

            {memberSince && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Member Since</p>
                <p className="text-sm text-muted-foreground">{memberSince}</p>
              </div>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
