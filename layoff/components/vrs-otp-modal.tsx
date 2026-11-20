"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Car,
  ArrowRight,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VRSVehicleRecord } from "@/lib/vrs-service";

interface VRSOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  vin: string;
  maskedPhone: string;
  vehicleSummary?: {
    make: string;
    model: string;
    registrationNumber: string;
    chassisNumber: string;
  };
  simulatedOtp?: string;
  onVerified: (vehicle: VRSVehicleRecord) => void;
  onResendOtp: () => Promise<{ success: boolean; otp?: string; error?: string }>;
}

export function VRSOTPModal({
  isOpen,
  onClose,
  vin,
  maskedPhone,
  vehicleSummary,
  simulatedOtp: initialSimulatedOtp,
  onVerified,
  onResendOtp,
}: VRSOTPModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(30);
  const [activeSimulatedOtp, setActiveSimulatedOtp] = useState<string | undefined>(initialSimulatedOtp);
  const [isSuccessAnimation, setIsSuccessAnimation] = useState(false);
  const [mounted, setMounted] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep simulated OTP updated if changed by parent
  useEffect(() => {
    if (initialSimulatedOtp) {
      setActiveSimulatedOtp(initialSimulatedOtp);
    }
  }, [initialSimulatedOtp]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (!isOpen) return;
    setDigits(["", "", "", "", "", ""]);
    setError(null);
    setIsSuccessAnimation(false);
    setResendCountdown(30);

    // Auto-focus first input on open
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);

    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleDigitChange = (index: number, val: string) => {
    // Only accept numbers
    const cleaned = val.replace(/\D/g, "");
    setError(null);

    // If user pasted a multi-digit string (e.g. 6 digits)
    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, 6).split("");
      const nextDigits = [...digits];
      pasteDigits.forEach((d, i) => {
        if (i < 6) nextDigits[i] = d;
      });
      setDigits(nextDigits);

      const nextFocus = Math.min(pasteDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();

      if (pasteDigits.length === 6) {
        triggerVerification(nextDigits.join(""));
      }
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleaned;
    setDigits(nextDigits);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit when all 6 digits entered
    if (cleaned && index === 5) {
      const fullCode = nextDigits.join("");
      if (fullCode.length === 6) {
        triggerVerification(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const nextDigits = ["", "", "", "", "", ""];
    pasted.split("").forEach((d, i) => {
      if (i < 6) nextDigits[i] = d;
    });
    setDigits(nextDigits);

    const nextFocus = Math.min(pasted.length, 5);
    inputRefs.current[nextFocus]?.focus();

    if (pasted.length === 6) {
      triggerVerification(pasted);
    }
  };

  const triggerVerification = async (otpCode: string) => {
    if (otpCode.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/vrs/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin, otp: otpCode }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Invalid OTP code. Please enter the correct 6-digit code sent to your phone.");
        setIsVerifying(false);
      } else {
        setIsSuccessAnimation(true);
        setTimeout(() => {
          onVerified(data.vehicle);
          onClose();
        }, 600);
      }
    } catch (err) {
      console.error(err);
      setError("Network error while verifying OTP. Please check your connection and try again.");
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || isResending) return;
    setIsResending(true);
    setError(null);

    try {
      const result = await onResendOtp();
      if (result.success) {
        if (result.otp) {
          setActiveSimulatedOtp(result.otp);
        }
        setResendCountdown(30);
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setError(result.error || "Failed to resend OTP. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to resend OTP. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleAutoFill = () => {
    if (!activeSimulatedOtp || activeSimulatedOtp.length !== 6) return;
    const split = activeSimulatedOtp.split("");
    setDigits(split);
    triggerVerification(activeSimulatedOtp);
  };

  const isComplete = digits.every((d) => d.length === 1);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/25 dark:bg-black/45 backdrop-blur-[2px] transition-all duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-[#006837] to-emerald-400" />

        {/* Close button */}
        <button
          onClick={onClose}
          type="button"
          disabled={isVerifying}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 pt-2">
          {isSuccessAnimation && (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 shadow-xs mb-1">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          )}
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Verify Registered Vehicle
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-sm mx-auto">
            A 6-digit One-Time Password (OTP) has been dispatched via SMS to the mobile number registered with this vehicle.
          </p>
        </div>

        {/* Vehicle & Phone Info Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5 text-slate-400" />
              Target Vehicle:
            </span>
            <span className="font-bold text-slate-900 dark:text-zinc-100">
              {vehicleSummary ? `${vehicleSummary.make} ${vehicleSummary.model}` : "Registered Vehicle"}
              {vehicleSummary?.registrationNumber && ` (${vehicleSummary.registrationNumber})`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-slate-400" />
              Registered Mobile:
            </span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {maskedPhone}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Chassis VIN:</span>
            <span className="font-mono text-slate-700 dark:text-zinc-300">
              {vin}
            </span>
          </div>
        </div>

        {/* Interactive Simulated SMS Toast Banner */}
        {activeSimulatedOtp && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-start justify-between gap-3 animate-fade-in">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-[#006837] text-white shrink-0 mt-0.5">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                  <span>Simulated SMS Delivered</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-400 text-emerald-700 dark:text-emerald-300">
                    Live Demo
                  </Badge>
                </p>
                <p className="text-emerald-800 dark:text-emerald-300/90 text-[11px] mt-0.5 font-mono">
                  Code: <strong className="font-extrabold tracking-wider">{activeSimulatedOtp}</strong>
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoFill}
              className="h-7 text-[11px] font-bold border-emerald-600/40 text-[#006837] dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shrink-0 gap-1 rounded-lg"
            >
              <Sparkles className="h-3 w-3" />
              Auto-fill
            </Button>
          </div>
        )}

        {/* 6-Digit OTP Input Box */}
        <div className="space-y-3">
          <label className="block text-center text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Enter 6-Digit Verification Code
          </label>

          <div className="flex justify-center items-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                disabled={isVerifying || isSuccessAnimation}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`h-12 w-11 sm:h-14 sm:w-12 text-center text-xl sm:text-2xl font-mono font-black rounded-xl border transition-all ${
                  error
                    ? "border-red-400 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400 focus:ring-red-400"
                    : digit
                    ? "border-[#006837] dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 text-[#006837] dark:text-emerald-300 shadow-xs"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                } focus:outline-none focus:ring-3 focus:ring-[#006837]/20 focus:border-[#006837] dark:focus:ring-emerald-500/25 dark:focus:border-emerald-500`}
              />
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Resend & Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            type="button"
            onClick={() => triggerVerification(digits.join(""))}
            disabled={!isComplete || isVerifying || isSuccessAnimation}
            className="w-full h-12 bg-[#006837] hover:bg-[#00552d] text-white font-bold rounded-xl text-sm gap-2 shadow-sm transition-all"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Verifying OTP Code...
              </>
            ) : isSuccessAnimation ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Vehicle Verified! Loading Details...
              </>
            ) : (
              <>
                Verify &amp; Unlock Vehicle Details
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-between text-xs pt-1 px-1">
            <span className="text-slate-500">Didn&apos;t receive SMS?</span>
            {resendCountdown > 0 ? (
              <span className="text-slate-400 font-medium">
                Resend code in <strong className="font-mono text-slate-600 dark:text-zinc-400">{resendCountdown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="font-bold text-[#006837] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {isResending && <RefreshCw className="h-3 w-3 animate-spin" />}
                Resend SMS Code
              </button>
            )}
          </div>
        </div>

        {/* Cancel / Change chassis option */}
        <div className="pt-2 text-center border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 font-medium hover:underline"
          >
            Cancel &amp; Change Chassis Number
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
