"use client";

import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { OTP_LENGTH } from "@/lib/constants";

interface OtpInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

export function OtpInput({
  length = OTP_LENGTH,
  onComplete,
  disabled = false,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback((index: number) => {
    inputsRef.current[index]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, "").slice(-1);
      const input = inputsRef.current[index];
      if (input) input.value = digit;

      if (digit && index < length - 1) {
        focusInput(index + 1);
      }

      const otp = inputsRef.current.map((el) => el?.value ?? "").join("");
      if (otp.length === length && /^\d+$/.test(otp)) {
        onComplete(otp);
      }
    },
    [length, onComplete, focusInput],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        const input = inputsRef.current[index];
        if (input?.value) {
          input.value = "";
        } else if (index > 0) {
          const prev = inputsRef.current[index - 1];
          if (prev) prev.value = "";
          focusInput(index - 1);
        }
      }
    },
    [focusInput],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      pasted.split("").forEach((digit, i) => {
        const input = inputsRef.current[i];
        if (input) input.value = digit;
      });

      const nextIndex = Math.min(pasted.length, length - 1);
      focusInput(nextIndex);

      if (pasted.length === length) {
        onComplete(pasted);
      }
    },
    [length, onComplete, focusInput],
  );

  return (
    <div className="flex gap-2">
      {Array.from({ length }, (_, i) => (
        <Input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          className="h-12 w-12 text-center text-lg"
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
