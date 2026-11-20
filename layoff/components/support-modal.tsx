"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  FileText,
  Search,
  CreditCard,
  Car,
  Clock,
  MessageSquare,
  User,
  Send,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultName?: string;
  defaultContact?: string;
}

const SUPPORT_TOPICS = [
  {
    icon: Search,
    title: "Vehicle Verification (VRS)",
    desc: "Assistance with Chassis/VIN lookup, missing VRS records, and vehicle registration synchronization.",
    faq: [
      {
        q: "Why does my VIN return 'Vehicle Not Found' in VRS?",
        a: "Ensure the 17-character VIN is entered correctly without spaces or forbidden letters (I, O, Q). If the vehicle is newly registered, contact the DVLA vehicle registration desk for database synchronization.",
      },
      {
        q: "Can I proceed with the layoff application if VRS is temporarily down?",
        a: "Under Regulation 48 and DVLA policy, verification must be strictly verified against VRS. Please retry after a few minutes or verify your internet connectivity.",
      },
    ],
  },
  {
    icon: Car,
    title: "Owner Representation & Representative Details",
    desc: "Guidelines for agents, fleet managers, and family members applying on behalf of the registered owner.",
    faq: [
      {
        q: "What documents must a representative provide?",
        a: "A representative must provide a valid Ghana Card, formal Power of Attorney or letter of authorization from the registered owner, and valid contact information.",
      },
      {
        q: "Will representative details alter the official vehicle ownership?",
        a: "No. The registered owner from VRS and the applicant/representative remain completely separate legal entities in the application record.",
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Roadworthiness Eligibility & Cutoff Rules",
    desc: "Strict validity requirements for Private (3 months) and Commercial (2 months) vehicles.",
    faq: [
      {
        q: "What is the Strict Cutoff Rule for Roadworthiness?",
        a: "For Private vehicles, the roadworthiness certificate must expire strictly AFTER 3 calendar months from the application date. For Commercial vehicles, strictly AFTER 2 calendar months. If the certificate expires on or before the cutoff date, the vehicle is legally ineligible.",
      },
      {
        q: "What should I do if my roadworthiness certificate fails the cutoff?",
        a: "You must renew your roadworthiness certificate at an authorized DVLA vehicle testing station before submitting the layoff request.",
      },
    ],
  },
  {
    icon: FileText,
    title: "Inspection Arrangements (Office vs On-Site)",
    desc: "Scheduling office inspections at DVLA regional centers or booking an on-site technical inspection.",
    faq: [
      {
        q: "How does an On-Site inspection work?",
        a: "If the vehicle cannot be driven to a DVLA station, request an on-site visit. A DVLA technical officer will be assigned to visit the designated garage or facility at an additional statutory field fee.",
      },
      {
        q: "What are the 5 mandatory vehicle photographs?",
        a: "Technical Officers capture: 1) Front View, 2) Rear View, 3) Left Side View, 4) Right Side View, and 5) Chassis/VIN & Odometer stamping.",
      },
    ],
  },
  {
    icon: CreditCard,
    title: "Invoice Generation & IPP Pro Payments",
    desc: "Understanding billing, IPP Pro transaction references, and payment confirmation.",
    faq: [
      {
        q: "Why is my invoice not generated immediately?",
        a: "Invoices are generated through IPP Pro only after technical inspection and administrative approval conditions are completed.",
      },
      {
        q: "Does administrative approval mean my vehicle is laid off?",
        a: "No. Approval is NOT activation. The vehicle remains On Road and the application inactive until payment is verified and confirmed by IPP Pro.",
      },
    ],
  },
  {
    icon: Clock,
    title: "Layoff Expiry & Formal Return-to-Road",
    desc: "Monitoring off-road duration, SMS alerts, extensions, and statutory procedures to return vehicles to road use.",
    faq: [
      {
        q: "Does my vehicle automatically become 'On Road' when the layoff expires?",
        a: "No. Under DVLA compliance rules, a laid-off vehicle remains Off Road until a formal return-to-road procedure and statutory inspection are concluded.",
      },
    ],
  },
];

export function SupportModal({
  isOpen,
  onClose,
  defaultName = "",
  defaultContact = "",
}: SupportModalProps) {
  const [activeMode, setActiveMode] = useState<"message" | "faq">("message");
  const [selectedTopic, setSelectedTopic] = useState<number | null>(0);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Support Message Box State (matching NSS Portal ContactSupportModal)
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState(defaultContact);
  const [vehicleOrRef, setVehicleOrRef] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleFaq = (key: string) => {
    setExpandedFaq(expandedFaq === key ? null : key);
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    setMessage("");
    setErrorMsg(null);
    onClose();
  };

  const handleSubmitSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    if (!contact.trim()) {
      setErrorMsg("Please enter your phone number.");
      return;
    }

    const phone = contact.replace(/[\s\-()]/g, "").replace(/^\+/, "");
    if (!/^[0-9]{10,15}$/.test(phone)) {
      setErrorMsg("Please enter a valid phone number (digits only, e.g. 0241234567).");
      return;
    }

    if (!message.trim()) {
      setErrorMsg("Please describe your issue in the message box.");
      return;
    }

    setSubmitting(true);

    try {
      const trimmedRef = vehicleOrRef.trim().toUpperCase();
      const isLayoffRef = trimmedRef.startsWith("LAY-");

      const res = await fetch("/api/helpline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contact: phone,
          message: message.trim(),
          applicationReference: isLayoffRef ? trimmedRef : undefined,
          registrationNumber: !isLayoffRef && trimmedRef ? trimmedRef : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to submit support request. Please try again.");
      } else {
        setSubmittedTicket(data.ticketNumber || "SUBMITTED");
      }
    } catch (err: any) {
      console.error("Failed to submit support request:", err);
      setErrorMsg("Network error submitting support request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleReset}
      title="Contact DVLA Helpline & Support"
      description="Submit an inquiry or describe an issue in the support message box below, or browse frequently asked questions."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5 text-slate-800 dark:text-zinc-200">
        {/* Top Contact Strip + Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#006837] text-white flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Toll-Free Helpline</p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">0800-DVLA-GH (3852)</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#006837] text-white flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Email Support</p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">layoff.support@dvla.gov.gh</p>
              </div>
            </div>
          </div>

          {/* Switcher between Support Message Box and FAQs */}
          <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-zinc-800 shrink-0 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveMode("message")}
              className={cn(
                "flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeMode === "message"
                  ? "bg-[#006837] text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Send Message</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("faq")}
              className={cn(
                "flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeMode === "faq"
                  ? "bg-[#006837] text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              )}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>FAQs &amp; Guide</span>
            </button>
          </div>
        </div>

        {activeMode === "message" ? (
          /* ─── SUPPORT MESSAGE BOX (MATCHING NSSPORTAL2) ─── */
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden shadow-xs">
            <div className="px-5 py-4 bg-gradient-to-r from-[#0d5c2e] via-[#094824] to-teal-950 text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20">
                <MessageSquare className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">Helpline Support Message Box</h3>
                <p className="text-[11px] text-emerald-100/90 font-medium">
                  Submit an inquiry or describe an issue for our DVLA support team—you will receive an SMS confirmation.
                </p>
              </div>
            </div>

            {submittedTicket ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-[#0d5c2e] dark:text-emerald-400">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">Thank You!</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto font-medium">
                  Your support message has been logged with Ticket Reference{" "}
                  <span className="font-mono font-extrabold text-[#006837] dark:text-emerald-400">{submittedTicket}</span>.
                  Our technical support team has been notified and a confirmation SMS has been sent to your phone.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedTicket(null);
                      setMessage("");
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Send Another Message
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-6 py-2.5 rounded-xl bg-[#0d5c2e] text-white text-xs font-extrabold shadow-sm hover:bg-emerald-800 transition-colors cursor-pointer"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitSupportMessage} className="p-5 sm:p-6 space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#0d5c2e] dark:text-emerald-400" /> Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Mensah"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-[#0d5c2e] focus:bg-white dark:focus:bg-zinc-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#0d5c2e] dark:text-emerald-400" /> Phone Number *
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      maxLength={20}
                      value={contact}
                      onChange={(e) => setContact(e.target.value.replace(/[^0-9+\s\-()]/g, ""))}
                      placeholder="e.g. 0241234567"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-[#0d5c2e] focus:bg-white dark:focus:bg-zinc-900 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-[#0d5c2e] dark:text-emerald-400" /> Vehicle Number or Layoff Reference{" "}
                    <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={vehicleOrRef}
                    onChange={(e) => setVehicleOrRef(e.target.value)}
                    placeholder="e.g. GT-4920-22 or LAY-2026-GT492022"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-[#0d5c2e] focus:bg-white dark:focus:bg-zinc-900 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#0d5c2e] dark:text-emerald-400" /> Describe Your Issue *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please describe the issue or inquiry you are experiencing in detail..."
                    className="w-full p-3.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-[#0d5c2e] focus:bg-white dark:focus:bg-zinc-900 font-medium resize-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0d5c2e] hover:bg-emerald-800 text-white text-xs font-extrabold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? "Submitting..." : "Submit Request"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ─── TOPICS & FAQ TWO-COLUMN BROWSER ─── */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                Select Assistance Category
              </p>
              {SUPPORT_TOPICS.map((topic, idx) => {
                const Icon = topic.icon;
                const isSelected = selectedTopic === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedTopic(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-3 cursor-pointer",
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/60 text-[#006837] dark:text-emerald-400 font-bold shadow-xs"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", isSelected ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
                    <div>
                      <p className="font-semibold">{topic.title}</p>
                      <p className="text-[11px] font-normal text-slate-500 dark:text-zinc-400 line-clamp-1">{topic.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="md:col-span-7 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
              {selectedTopic !== null && (
                <div className="space-y-4">
                  <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      {SUPPORT_TOPICS[selectedTopic].title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      {SUPPORT_TOPICS[selectedTopic].desc}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Frequently Asked Questions
                    </p>
                    {SUPPORT_TOPICS[selectedTopic].faq.map((item, fIdx) => {
                      const faqKey = `${selectedTopic}-${fIdx}`;
                      const isExpanded = expandedFaq === faqKey;
                      return (
                        <div
                          key={fIdx}
                          className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
                        >
                          <button
                            onClick={() => toggleFaq(faqKey)}
                            className="w-full text-left p-3 text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                          >
                            <span>{item.q}</span>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 text-xs text-slate-600 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80 pt-2 leading-relaxed bg-slate-50/50 dark:bg-zinc-900/40">
                              {item.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
