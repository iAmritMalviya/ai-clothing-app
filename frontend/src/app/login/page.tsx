"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SendOtpResponse, AuthResponse, User } from "@/types";

type Step = "phone" | "otp";

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  async function handleSendOtp() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch<SendOtpResponse>("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      setStep("otp");
      toast.success("OTP sent!");
    } catch {
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(otp: string) {
    const digits = phone.replace(/\D/g, "");
    setSubmitting(true);
    try {
      const data = await apiFetch<AuthResponse>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone: digits, code: otp }),
      });
      login(data.token, data.user as User);
      router.push("/dashboard");
    } catch {
      toast.error("Invalid OTP. Please try again.");
      setSubmitting(false);
    }
  }

  if (isLoading) return null;
  if (user) return null;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">AI Clothing</CardTitle>
          <CardDescription>
            {step === "phone"
              ? "Enter your phone number to get started"
              : "Enter the OTP sent to your phone"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendOtp();
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex gap-2">
                <span className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                  +91
                </span>
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={10}
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <OtpInput onComplete={handleVerifyOtp} disabled={submitting} />
              {submitting && (
                <p className="text-sm text-muted-foreground">Verifying...</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("phone")}
                disabled={submitting}
              >
                Change phone number
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
