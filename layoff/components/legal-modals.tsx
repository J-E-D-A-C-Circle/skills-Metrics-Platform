"use client";

import React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileText, Lock, Scale, AlertTriangle, Printer } from "lucide-react";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyDialog({ isOpen, onClose }: LegalModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="DVLA Vehicle Layoff Portal — Privacy Policy"
      description="Statutory Data Protection Policy enacted under the Data Protection Act, 2012 (Act 843) of the Republic of Ghana."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed max-h-[75vh] overflow-y-auto pr-1">
        {/* Header Notice */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-[#006837] dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-[#006837] dark:text-emerald-400 text-xs sm:text-sm uppercase tracking-wide">Data Protection &amp; Confidentiality Guarantee</h4>
            <p className="text-xs text-emerald-950 dark:text-emerald-200 font-medium">
              The Driver and Vehicle Licensing Authority (DVLA) is legally committed to protecting the privacy, accuracy, and security of all personal and vehicle records submitted through this digital portal.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <span className="h-5 w-5 rounded-full bg-[#006837] dark:bg-emerald-600 text-white flex items-center justify-center text-[10px] font-mono">1</span>
            Statutory Scope &amp; Legal Authorization
          </h3>
          <p>
            This Privacy Policy governs the collection, processing, storage, and protection of personal identifiers and vehicle technical data provided by applicants requesting temporary Vehicle Layoff (Off-Road) status under Regulation 48 of the Road Traffic Regulations of the Republic of Ghana.
          </p>
        </div>

        {/* Section 2 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <span className="h-5 w-5 rounded-full bg-[#006837] dark:bg-emerald-600 text-white flex items-center justify-center text-[10px] font-mono">2</span>
            Categories of Personal &amp; Technical Data Collected
          </h3>
          <p>DVLA collects and processes the following statutory data payloads:</p>
          <ul className="list-disc pl-5 space-y-1 font-medium text-slate-800 dark:text-zinc-200">
            <li><strong>Personal Credentials:</strong> Applicant Full Name, Ghana Card Unique Identification Number (GHA-xxxxxxxx-x), Primary Contact Telephone Number, and Email Address.</li>
            <li><strong>Residential &amp; Geographic Data:</strong> Residential Physical Address, GhanaPost GPS Digital Address coordinates, and Storage Facility Regional location.</li>
            <li><strong>Vehicle Technical Specifications:</strong> Official Registration Mark, Chassis Vehicle Identification Number (VIN), Engine Serial Number, Vehicle Make, Model, Year of Manufacture, Body Colour, and Engine Cubic Capacity (cc).</li>
            <li><strong>Statutory Uploaded Evidence:</strong> Clear photographic evidence of front/rear vehicle aspects, scanned Vehicle Logbooks, Mechanic Inspection Reports, and Workshop Repair Estimates.</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <span className="h-5 w-5 rounded-full bg-[#006837] dark:bg-emerald-600 text-white flex items-center justify-center text-[10px] font-mono">3</span>
            Purpose of Data Processing
          </h3>
          <p>All collected data is processed strictly for legal and regulatory purposes, including:</p>
          <ul className="list-disc pl-5 space-y-1 font-medium text-slate-800 dark:text-zinc-200">
            <li>Validating applicant identity against National Identification Authority (NIA) Ghana Card records.</li>
            <li>Cross-checking vehicle chassis numbers against the national DVLA Motor Vehicle Registry to prevent fraudulent off-road declarations.</li>
            <li>Issuing statutory DVLA Vehicle Layoff Certificates and digital invoices.</li>
            <li>Dispatching one-time security OTP verification codes and SMS notification updates to registered applicant phone numbers.</li>
            <li>Enabling authorized law enforcement officers (Ghana Police Service Motor Traffic &amp; Transport Department - MTTD) to audit off-road vehicle status.</li>
          </ul>
        </div>

        {/* Section 4 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <span className="h-5 w-5 rounded-full bg-[#006837] dark:bg-emerald-600 text-white flex items-center justify-center text-[10px] font-mono">4</span>
            Data Protection &amp; Security Measures
          </h3>
          <p>
            In compliance with the Data Protection Act, 2012 (Act 843), DVLA employs industry-standard 256-bit SSL encryption, restricted role-based administrative controls, and secure database storage. Data is accessed solely by authorized DVLA verification officers and system administrators under strict confidentiality agreements.
          </p>
        </div>

        {/* Section 5 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <span className="h-5 w-5 rounded-full bg-[#006837] dark:bg-emerald-600 text-white flex items-center justify-center text-[10px] font-mono">5</span>
            Applicant Rights &amp; Records Access
          </h3>
          <p>
            Applicants have the legal right to request access to their submitted layoff history, verify active certificate status via the official digital portal, and request corrections to inaccurate personal records by contacting DVLA Customer Support or visiting any regional DVLA office.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
          <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono text-center sm:text-left">Document Ref: DVLA-DP-2026-v2</span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 flex-1 sm:flex-none justify-center">
              <Printer className="h-3.5 w-3.5" />
              Print Policy
            </Button>
            <Button size="sm" onClick={onClose} className="px-5 font-bold flex-1 sm:flex-none justify-center">
              Acknowledge &amp; Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export function TermsOfServiceDialog({ isOpen, onClose }: LegalModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="DVLA Vehicle Layoff Portal — Terms of Service"
      description="Statutory Terms & Statutory Declaration Governing Vehicle Off-Road Layoff Applications."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed max-h-[75vh] overflow-y-auto pr-1">
        {/* Warning Notice Banner */}
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm uppercase tracking-wide">Statutory Off-Road Legal Warning</h4>
            <p className="text-xs text-amber-950 dark:text-amber-200 font-medium leading-relaxed">
              Submitting a vehicle layoff application constitutes a binding statutory declaration that the vehicle will remain strictly off public roads. Operating a laid-off vehicle on public roads is a criminal offence punishable under Ghanaian law.
            </p>
          </div>
        </div>

        {/* Clause 1 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <Scale className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
            1. Off-Road Status &amp; Prohibition of Public Road Usage
          </h3>
          <p>
            By submitting an application for vehicle layoff status, the registered vehicle owner explicitly agrees and declares that:
          </p>
          <ul className="list-disc pl-5 space-y-1 font-medium text-slate-800 dark:text-zinc-200">
            <li>The specified motor vehicle will remain parked strictly off public roads, highways, and public parking zones during the entire approved layoff period.</li>
            <li>The vehicle shall not be driven, towed, or operated on any public road in the Republic of Ghana under any circumstances while layoff status is active.</li>
            <li>Violation of off-road status renders the vehicle license immediately invalid and subjects the owner to immediate impoundment, back-taxes, and criminal prosecution.</li>
          </ul>
        </div>

        {/* Clause 2 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <FileText className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
            2. Truthfulness of Submitted Credentials &amp; Documents
          </h3>
          <p>
            The applicant guarantees that all information provided—including Ghana Card identification credentials, chassis VIN numbers, storage location addresses, and uploaded photographs—is accurate, truthful, and authentic. Submission of fraudulent documents or altered chassis numbers is punishable under the Criminal Offences Act, 1960 (Act 29).
          </p>
        </div>

        {/* Clause 3 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <Lock className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
            3. Physical Inspection &amp; Statutory Audit Powers
          </h3>
          <p>
            DVLA enforcement officers and authorized inspectors reserve the right to conduct unannounced physical audits at the declared storage facility or garage address to verify that the vehicle is physically off-road and matches the registered chassis VIN.
          </p>
        </div>

        {/* Clause 4 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <Scale className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
            4. Statutory Fees, Payments &amp; Non-Refundability
          </h3>
          <p>
            All vehicle layoff processing fees are established pursuant to DVLA statutory fee schedules. Upon application approval, processing fees must be settled via the generated DVLA invoice. All statutory fees paid are strictly non-refundable.
          </p>
        </div>

        {/* Clause 5 */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-1.5">
            <AlertTriangle className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
            5. Expiry, Extensions &amp; Re-Licensing
          </h3>
          <p>
            Layoff status expires automatically on the date specified on the official DVLA Layoff Certificate. Owners wishing to extend layoff status must initiate an extension request via SMS OTP verification prior to the expiry date. Upon completion of the layoff period, the vehicle must undergo standard DVLA roadworthy inspection before returning to public roads.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
          <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono text-center sm:text-left">Document Ref: DVLA-TOS-2026-v2</span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 flex-1 sm:flex-none justify-center">
              <Printer className="h-3.5 w-3.5" />
              Print Terms
            </Button>
            <Button size="sm" onClick={onClose} className="px-5 font-bold flex-1 sm:flex-none justify-center">
              Accept &amp; Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

