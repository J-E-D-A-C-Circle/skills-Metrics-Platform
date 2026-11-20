"use client";

import React, { useState } from "react";
import { Car, Phone, Mail, MapPin } from "lucide-react";
import { PrivacyPolicyDialog, TermsOfServiceDialog } from "@/components/legal-modals";

export function Footer() {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  return (
    <footer className="bg-[#00381d] dark:bg-[#09090b] text-emerald-100 dark:text-zinc-300 pt-10 pb-6 border-t-4 border-[#facc15] dark:border-zinc-800 font-sans transition-colors duration-150">
      <div className="container mx-auto max-w-[1720px] px-4 sm:px-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 pb-8 border-b border-emerald-900 dark:border-zinc-800">
          
          {/* Col 1: DVLA Branding */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded bg-[#006837] dark:bg-emerald-700 border border-yellow-400 dark:border-emerald-500 flex items-center justify-center text-white font-bold">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <span className="text-base font-extrabold text-white dark:text-zinc-100 tracking-tight">DVLA GHANA</span>
                <p className="text-[10px] text-emerald-300 dark:text-zinc-400 font-medium">Driver &amp; Vehicle Licensing Authority</p>
              </div>
            </div>
            <p className="text-xs text-emerald-200/80 dark:text-zinc-400 leading-relaxed font-medium">
              Official digital platform for Vehicle Layoff Application, statutory verification, approval, invoicing, and SMS OTP extensions.
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#facc15] dark:text-emerald-400">
              Public Portal
            </h4>
            <ul className="space-y-1.5 text-xs text-emerald-200 dark:text-zinc-400 font-medium">
              <li>Submit Layoff Application</li>
              <li>Track Layoff Status</li>
              <li>Request Layoff Extension (OTP)</li>
              <li>Verify Invoice</li>
            </ul>
          </div>

          {/* Col 3: Statutory Regulations */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#facc15] dark:text-emerald-400">
              Regulations
            </h4>
            <ul className="space-y-1.5 text-xs text-emerald-200 dark:text-zinc-400 font-medium">
              <li>Road Traffic Regulations (Act 683)</li>
              <li>Chassis VIN Verification Rules</li>
              <li>Off-Road Storage Declaration</li>
            </ul>
          </div>

          {/* Col 4: Official Contact */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#facc15] dark:text-emerald-400">
              DVLA Contact
            </h4>
            <div className="space-y-1.5 text-xs text-emerald-200 dark:text-zinc-400">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-yellow-400 dark:text-emerald-400 shrink-0" />
                DVLA Headquarters, Accra
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-yellow-400 dark:text-emerald-400 shrink-0" />
                Helpline: +233 (0) 30 277 1701
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-yellow-400 dark:text-emerald-400 shrink-0" />
                layoff-support@dvla.gov.gh
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-emerald-300/80 dark:text-zinc-400 gap-3">
          <p>© {new Date().getFullYear()} Driver and Vehicle Licensing Authority (DVLA). All Rights Reserved.</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:text-yellow-300 dark:hover:text-emerald-400 transition-colors font-medium underline-offset-4 hover:underline"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsTermsOpen(true)}
              className="hover:text-yellow-300 dark:hover:text-emerald-400 transition-colors font-medium underline-offset-4 hover:underline"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Legal Modals */}
      <PrivacyPolicyDialog isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <TermsOfServiceDialog isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </footer>
  );
}

