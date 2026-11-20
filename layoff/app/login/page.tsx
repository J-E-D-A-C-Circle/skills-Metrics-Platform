"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupportModal } from "@/components/support-modal";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // First-Time Sign-In Password Change State
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [firstLoginUser, setFirstLoginUser] = useState<{
    email: string;
    staffId?: string | null;
    fullName: string;
    role: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Authentication failed.");
        setLoading(false);
        return;
      }

      // Check if first-time login requires changing default password
      if (data.requiresPasswordChange) {
        setFirstLoginUser({
          email: data.email || email,
          staffId: data.staffId,
          fullName: data.fullName || "Authorized Staff",
          role: data.role || "STAFF",
        });
        setMustChangePassword(true);
        setNewPassword("");
        setConfirmPassword("");
        setLoading(false);
        return;
      }

      // Successful login -> redirect to destination or role dashboard
      const target = redirectParam || data.redirectTo || "/";
      router.push(target);
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage("Network or connection error. Please try again.");
      setLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.trim().length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword.trim() === "Password@123" || newPassword.trim() === "Password123!") {
      setErrorMessage("Please choose a new personal password different from the default password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation password do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: firstLoginUser?.email || email,
          currentPassword: password,
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to update password.");
        setChangingPassword(false);
        return;
      }

      // Return to Sign-In form so user can sign in with their username/email and new password
      setMustChangePassword(false);
      setFirstLoginUser(null);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(
        "Password changed successfully! Please sign in with your username/email and new password."
      );
    } catch (err) {
      console.error(err);
      setErrorMessage("Network error while updating password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleQuickFill = (testEmail: string) => {
    setMustChangePassword(false);
    setEmail(testEmail);
    setPassword("Password@123");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex flex-col justify-between text-slate-900 dark:text-zinc-100 font-sans selection:bg-emerald-600 selection:text-white">
      {/* Top Banner */}
      <div className="bg-[#004d28] dark:bg-[#00361c] px-4 py-2 border-b border-[#003b1e]">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-emerald-200">
          <span className="font-semibold tracking-wide">REPUBLIC OF GHANA — DRIVER AND VEHICLE LICENSING AUTHORITY</span>
          <Link href="/" className="hover:text-white transition-colors underline underline-offset-2">
            Public Citizen Portal →
          </Link>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Card */}
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl p-7 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6 relative overflow-hidden">
            {/* Subtle Green Decorative Gradient Accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#004d28] via-[#006837] to-emerald-500" />

            {/* Header / Brand */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center relative h-16 w-16 mx-auto">
                <Image
                  src="/oop.png"
                  alt="DVLA Ghana Crest"
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                  {mustChangePassword ? "Set Personal Password" : "Official Staff Portal"}
                </h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
                  {mustChangePassword
                    ? "First-time sign-in security requirement"
                    : "Vehicle Layoff Management & Regional Inspection System"}
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-[11px] font-bold text-[#006837] dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                L.I. 2519 Regulation 28 Authorized Access
              </div>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200 animate-fade-in">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#006837] dark:text-emerald-400" />
                <span className="font-semibold leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-shake">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span className="font-semibold leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {mustChangePassword ? (
              /* ─── FIRST-TIME LOGIN PASSWORD CHANGE FORM ─── */
              <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-1 text-xs">
                  <div className="flex items-center gap-2 font-extrabold text-amber-900 dark:text-amber-300">
                    <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Welcome, {firstLoginUser?.fullName}</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                    You signed in using the default password (<span className="font-mono font-bold">Password@123</span>). Please create a new personal password to activate your account ({firstLoginUser?.email}).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    New Personal Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Enter new password (min. 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 text-xs rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 text-xs rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full h-11 rounded-xl bg-[#006837] hover:bg-[#004d28] text-white font-bold text-xs shadow-md shadow-emerald-900/20 gap-2"
                  >
                    {changingPassword ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating Password...
                      </span>
                    ) : (
                      <>
                        <span>Save New Password &amp; Proceed to Sign In</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMustChangePassword(false);
                      setErrorMessage(null);
                    }}
                    className="w-full h-9 rounded-xl text-xs text-slate-500 gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Sign In</span>
                  </Button>
                </div>
              </form>
            ) : (
              /* ─── STANDARD LOGIN FORM ─── */
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>Official Email </span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        required
                        placeholder="e.g. Johnson.Ben@dvla.gov.gh"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 text-xs rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>Password</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Enter official password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-11 text-xs rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-[#006837] hover:bg-[#004d28] text-white font-bold text-xs shadow-md shadow-emerald-900/20 gap-2 transition-all"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Authenticating...
                      </span>
                    ) : (
                      <>
                        <span>Sign In </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Quick Demo Credentials Selector */}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 text-center">
                    Quick Demonstration Access
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleQuickFill("admin@dvla.gov.gh")}
                      className="p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 text-left transition-colors"
                    >
                      <p className="font-bold text-[#006837] dark:text-emerald-400">Administrator</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">admin@dvla.gov.gh</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickFill("officer.accra@dvla.gov.gh")}
                      className="p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 text-left transition-colors"
                    >
                      <p className="font-bold text-amber-800 dark:text-amber-400">Technical Officer</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">officer.accra@dvla.gov.gh</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickFill("compliance@dvla.gov.gh")}
                      className="p-2.5 rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/60 text-left transition-colors"
                    >
                      <p className="font-bold text-blue-800 dark:text-blue-400">Compliance Manager</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">compliance@dvla.gov.gh</p>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Support Trigger & Footer Note */}
          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => setIsSupportOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006837] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Need Help? Contact DVLA Support</span>
            </button>
            <p className="text-center text-xs text-slate-400 dark:text-zinc-500">
              © {new Date().getFullYear()} Driver and Vehicle Licensing Authority (DVLA). All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#09090b]" />}>
      <LoginFormContent />
    </Suspense>
  );
}
