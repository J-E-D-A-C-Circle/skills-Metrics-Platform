"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  Check, Upload, ArrowLeft, ArrowRight, FileText, Camera,
  AlertCircle, User, Car, MapPin, Paperclip,
  Phone, Mail, CreditCard, Home, Fingerprint,
  Gauge, Palette, CalendarDays, Building2, ClipboardList,
  Trash2, Plus, FileCheck, ImageIcon, X, Search, ShieldCheck,
  Wrench, CheckCircle2, AlertTriangle, RefreshCw, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LayoffApplication } from "@/lib/mock-data";
import { VRSVehicleRecord, validateVINFormat } from "@/lib/vrs-service";
import { VRSOTPModal } from "./vrs-otp-modal";
import {
  validateRoadworthinessEligibility,
  calculateRoadworthinessCutoff,
  evaluateEmergencyMechanicalFailure,
} from "@/lib/roadworthiness";
import { calculateLayoffFeeBreakdown, getEmergencyMechanicalFailureFee } from "@/lib/ipp-pro-service";
import { GHANA_REGIONS, DEFAULT_DVLA_STATIONS, DVLAStation } from "@/lib/stations-data";

interface ApplicationWizardProps {
  onSuccess: (newApp: LayoffApplication) => void;
  onCancel: () => void;
  editingApplication?: LayoffApplication | null;
}

interface UploadedFileItem {
  id: string;
  name: string;
  size: string;
  type?: string;
  previewUrl?: string;
  category?: string;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "1.5 MB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatGhanaCardNumber(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 9) {
    return `GHA-${digits}`;
  }
  return `GHA-${digits.slice(0, 9)}-${digits.slice(9)}`;
}

const STEPS = [
  { num: 1, title: "VRS Verification", icon: Search,        color: "from-emerald-600 to-[#006837]" },
  { num: 2, title: "Roadworthiness",   icon: ShieldCheck,   color: "from-emerald-600 to-[#006837]" },
  { num: 3, title: "Layoff & Inspect", icon: MapPin,        color: "from-emerald-600 to-[#006837]" },
  { num: 4, title: "Evidence & Photos",icon: Camera,        color: "from-emerald-600 to-[#006837]" },
  { num: 5, title: "Declaration",      icon: ClipboardList, color: "from-emerald-600 to-[#006837]" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 mt-1.5 text-xs text-red-500 font-medium">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function IconInput({
  icon: Icon,
  className,
  ...props
}: { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
        <Icon className="h-4 w-4" />
      </div>
      <input
        className={cn(
          "flex h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500",
          "hover:border-slate-300 dark:hover:border-zinc-700 focus:outline-none focus:border-[#006837] dark:focus:border-emerald-500 focus:ring-3 focus:ring-[#006837]/12 dark:focus:ring-emerald-500/20",
          "transition-[border-color,box-shadow,background-color] duration-150",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function ApplicationWizard({ onSuccess, onCancel, editingApplication }: ApplicationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ─── Step 1: VRS Verification States ───
  const [vinInput, setVinInput] = useState(editingApplication?.chassisNumber || "JN1AZ34A890123456");
  const [isVerifyingVRS, setIsVerifyingVRS] = useState(false);
  const [vrsError, setVrsError] = useState<string | null>(null);
  const [vrsRecord, setVrsRecord] = useState<VRSVehicleRecord | null>(null);
  const [isVrsVerified, setIsVrsVerified] = useState(Boolean(editingApplication?.vrsVerified));

  // VRS OTP Verification Modal States
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpTargetVin, setOtpTargetVin] = useState("");
  const [otpMaskedPhone, setOtpMaskedPhone] = useState("");
  const [otpSimulatedCode, setOtpSimulatedCode] = useState<string | undefined>(undefined);
  const [otpVehicleSummary, setOtpVehicleSummary] = useState<{
    make: string;
    model: string;
    registrationNumber: string;
    chassisNumber: string;
  } | undefined>(undefined);

  // Applicant Type: Owner vs Representative
  const [applicantType, setApplicantType] = useState<"OWNER" | "REPRESENTATIVE">(editingApplication?.applicantType || "OWNER");

  // Registered Owner Information (Retrieved from VRS)
  const [ownerName, setOwnerName] = useState(editingApplication?.ownerName || editingApplication?.applicantName || "");
  const [ownerIdNumber, setOwnerIdNumber] = useState(editingApplication?.ownerIdNumber || editingApplication?.idNumber || "");
  const [ownerPhone, setOwnerPhone] = useState(editingApplication?.ownerPhone || editingApplication?.applicantPhone || "");
  const [ownerEmail, setOwnerEmail] = useState(editingApplication?.ownerEmail || editingApplication?.applicantEmail || "");
  const [residentialAddress, setResidentialAddress] = useState(editingApplication?.residentialAddress || "");
  const [digitalAddress, setDigitalAddress] = useState(editingApplication?.digitalAddress || "");

  // Representative Information
  const [repName, setRepName] = useState(editingApplication?.representativeName || "");
  const [repPhone, setRepPhone] = useState(editingApplication?.representativePhone || "");
  const [repEmail, setRepEmail] = useState(editingApplication?.representativeEmail || "");
  const [repIdType, setRepIdType] = useState(editingApplication?.representativeIdType || "Ghana Card");
  const [repIdNumber, setRepIdNumber] = useState(editingApplication?.representativeIdNumber || "");
  const [repRelationship, setRepRelationship] = useState(editingApplication?.representativeRelationship || "Authorized Representative");
  const [repAddress, setRepAddress] = useState(editingApplication?.representativeAddress || "");

  // Vehicle Specifications (Populated by VRS)
  const [registrationNumber, setRegistrationNumber] = useState(editingApplication?.registrationNumber || "");
  const [chassisNumber, setChassisNumber] = useState(editingApplication?.chassisNumber || "");
  const [engineNumber, setEngineNumber] = useState(editingApplication?.engineNumber || "");
  const [make, setMake] = useState(editingApplication?.make || "");
  const [model, setModel] = useState(editingApplication?.model || "");
  const [yearOfMake, setYearOfMake] = useState(editingApplication?.yearOfMake || "2022");
  const [vehicleType, setVehicleType] = useState<any>(editingApplication?.vehicleType || "Private Saloon");
  const [colour, setColour] = useState(editingApplication?.colour || "Midnight Blue");

  // ─── Step 2: Vehicle Classification & Roadworthiness ───
  const [vehicleUsageClassification, setVehicleUsageClassification] = useState<"Private" | "Commercial">(
    editingApplication?.vehicleUsageClassification || "Private"
  );
  const [roadworthinessExpiryDate, setRoadworthinessExpiryDate] = useState(
    editingApplication?.roadworthinessExpiryDate || "2027-04-15"
  );
  const [roadworthinessError, setRoadworthinessError] = useState<string | null>(null);
  const [isEmergencyMechanicalFailure, setIsEmergencyMechanicalFailure] = useState(
    Boolean(editingApplication?.isEmergencyMechanicalFailure)
  );

  // ─── Step 3: Layoff Details & Inspection Method ───
  const [reason, setReason] = useState<any>(editingApplication?.reason || "Mechanical Failure / Overhaul");
  const [explanation, setExplanation] = useState(editingApplication?.explanation || "");
  const [storageFacilityName, setStorageFacilityName] = useState(editingApplication?.storageFacilityName || "");
  const [storageRegion, setStorageRegion] = useState(editingApplication?.storageRegion || "Greater Accra");
  const [proposedStartDate, setProposedStartDate] = useState(
    editingApplication?.proposedStartDate || new Date().toISOString().split("T")[0]
  );
  const [layoffPeriodMonths, setLayoffPeriodMonths] = useState(editingApplication?.layoffPeriodMonths || 6);

  // Inspection Method
  const [inspectionMethod, setInspectionMethod] = useState<"OFFICE" | "ON_SITE">(
    editingApplication?.inspectionMethod || "OFFICE"
  );
  const [inspectionOfficeLocation, setInspectionOfficeLocation] = useState(
    editingApplication?.inspectionOfficeLocation || "DVLA 37 Head Office - Accra"
  );
  const [inspectionSiteAddress, setInspectionSiteAddress] = useState(editingApplication?.inspectionSiteAddress || "");
  const [inspectionSiteArea, setInspectionSiteArea] = useState(editingApplication?.inspectionSiteArea || "");
  const [inspectionContactPerson, setInspectionContactPerson] = useState(editingApplication?.inspectionContactPerson || "");
  const [inspectionContactPhone, setInspectionContactPhone] = useState(editingApplication?.inspectionContactPhone || "");
  const [inspectionNotes, setInspectionNotes] = useState(editingApplication?.inspectionNotes || "");
  const [availableStations, setAvailableStations] = useState<DVLAStation[]>(DEFAULT_DVLA_STATIONS);

  React.useEffect(() => {
    fetch("/api/stations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stations && Array.isArray(data.stations) && data.stations.length > 0) {
          setAvailableStations(data.stations);
        }
      })
      .catch(() => {});
  }, []);

  // ─── Step 4: Documents & 5 Mandatory Photographs ───
  // Title Document
  const [titleDocument, setTitleDocument] = useState<UploadedFileItem | null>({
    id: "doc-1",
    name: "Vehicle_Registration_Document_Title.pdf",
    size: "2.1 MB",
    type: "PDF",
    category: "document_title",
  });

  // Representative Authorization Document (Requirement 1)
  const [representativeAuthDoc, setRepresentativeAuthDoc] = useState<UploadedFileItem | null>(null);
  const repAuthFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadRepresentativeAuth = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.files?.[0]) {
        const f = data.files[0];
        setRepresentativeAuthDoc({
          id: f.savedName,
          name: f.name,
          size: f.size,
          type: f.type,
          previewUrl: f.fileUrl,
          category: "representative_auth",
        });
        setFormErrors(prev => {
          const next = { ...prev };
          delete next.representativeAuth;
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to upload authorization doc:", err);
    }
  };

  // Legal Action Document (Mandatory when reason === "Legal Action")
  const [legalDocument, setLegalDocument] = useState<UploadedFileItem | null>(() => {
    const existing = editingApplication?.documents?.find(d => d.category === "legal_document");
    if (existing) {
      return {
        id: "legal-doc-init",
        name: existing.name,
        size: existing.size || "1.5 MB",
        type: existing.type || "PDF",
        previewUrl: existing.url,
        category: "legal_document",
      };
    }
    return null;
  });
  const legalDocFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadLegalDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.files?.[0]) {
        const f = data.files[0];
        setLegalDocument({
          id: f.savedName,
          name: f.name,
          size: f.size,
          type: f.type,
          previewUrl: f.fileUrl,
          category: "legal_document",
        });
        setFormErrors(prev => {
          const next = { ...prev };
          delete next.legalDocument;
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to upload legal doc:", err);
    }
  };

  // 5 Mandatory Vehicle Photographs
  const [photoFront, setPhotoFront] = useState<string>("/placeholder-car-front.jpg");
  const [photoSide, setPhotoSide] = useState<string>("/placeholder-car-side.jpg");
  const [photoRear, setPhotoRear] = useState<string>("/placeholder-car-rear.jpg");
  const [photoEngine, setPhotoEngine] = useState<string>("/placeholder-car-engine.jpg");
  const [photoChassis, setPhotoChassis] = useState<string>("/placeholder-car-chassis.jpg");

  // Additional support documents
  const [additionalDocs, setAdditionalDocs] = useState<UploadedFileItem[]>([]);

  // ─── Step 5: Declaration ───
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  // Ref to scroll to verified VRS vehicle data
  const verifiedDataRef = useRef<HTMLDivElement | null>(null);

  // Quick sample VIN helper
  const handleSelectSampleVIN = (vin: string) => {
    setVinInput(vin);
    setVrsError(null);
  };

  // Perform VRS Verification - Dispatches SMS OTP to Registered Vehicle Owner
  const handleVerifyVRS = async () => {
    setVrsError(null);
    const formatCheck = validateVINFormat(vinInput);
    if (!formatCheck.isValid) {
      setVrsError(formatCheck.error || "Invalid VIN format");
      return;
    }

    setIsVerifyingVRS(true);
    try {
      const res = await fetch("/api/vrs/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: formatCheck.normalized }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setVrsError(data.error || "Vehicle verification request failed.");
        setIsVrsVerified(false);
      } else {
        setOtpTargetVin(formatCheck.normalized);
        setOtpMaskedPhone(data.maskedPhone || "+233 24 ••• ••••");
        setOtpSimulatedCode(data.otp);
        setOtpVehicleSummary(data.vehicleSummary);
        setIsOtpModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setVrsError("Failed to reach VRS gateway. Please check connection and retry.");
    } finally {
      setIsVerifyingVRS(false);
    }
  };

  const handleResendVrsOtp = async () => {
    try {
      const res = await fetch("/api/vrs/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: otpTargetVin || vinInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to resend OTP" };
      }
      setOtpSimulatedCode(data.otp);
      return { success: true, otp: data.otp };
    } catch (err) {
      console.error(err);
      return { success: false, error: "Network error while resending OTP" };
    }
  };

  // Called when client enters correct OTP in the modal
  const handleVrsOtpVerified = (vehicle: VRSVehicleRecord) => {
    setVrsRecord(vehicle);
    setIsVrsVerified(true);
    setVrsError(null);

    // Auto-populate vehicle details
    setRegistrationNumber(vehicle.registrationNumber);
    setChassisNumber(vehicle.chassisNumber);
    setEngineNumber(vehicle.engineNumber);
    setMake(vehicle.make);
    setModel(vehicle.model);
    setYearOfMake(vehicle.yearOfMake);
    setColour(vehicle.colour);
    setVehicleType(vehicle.vehicleType as any);
    setVehicleUsageClassification(vehicle.vehicleUsageClassification);
    setRoadworthinessExpiryDate(vehicle.roadworthinessExpiryDate);

    // Auto-populate registered owner details
    setOwnerName(vehicle.registeredOwner.name);
    setOwnerIdNumber(vehicle.registeredOwner.idNumber);
    setOwnerPhone(vehicle.registeredOwner.phone);
    setOwnerEmail(vehicle.registeredOwner.email);
    setResidentialAddress(vehicle.registeredOwner.residentialAddress);
    setDigitalAddress(vehicle.registeredOwner.digitalAddress);

    // Auto scroll down to revealed vehicle details
    setTimeout(() => {
      if (verifiedDataRef.current) {
        verifiedDataRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 150);
  };

  // Real-time Roadworthiness & Emergency Evaluation
  const todayStr = new Date().toISOString().split("T")[0];
  const roadworthinessStatus = validateRoadworthinessEligibility(
    roadworthinessExpiryDate,
    todayStr,
    vehicleUsageClassification,
    { isEmergencyMechanicalFailure }
  );

  const emergencyEvaluation = evaluateEmergencyMechanicalFailure(
    roadworthinessExpiryDate,
    todayStr,
    vehicleUsageClassification,
    isEmergencyMechanicalFailure
  );

  const estimatedFeeBreakdown = calculateLayoffFeeBreakdown({
    vehicleType,
    inspectionMethod,
    isEmergencyMechanicalFailure,
    roadworthinessExpiryDate,
    applicationDate: todayStr,
    vehicleUsageClassification,
  });

  // Step Validation logic
  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (currentStep === 1) {
      const vinCheck = validateVINFormat(vinInput);
      if (!vinCheck.isValid) {
        errors.vrs = vinCheck.error || "Chassis number must contain at least 12 characters.";
      } else if (!isVrsVerified) {
        errors.vrs = "You must verify the vehicle VIN against the Vehicle Registration System (VRS) to proceed.";
      }
      if (applicantType === "REPRESENTATIVE") {
        if (!repName.trim()) errors.repName = "Representative full name is required.";
        if (!repPhone.trim()) errors.repPhone = "Representative contact number is required.";
        if (!repIdNumber.trim()) errors.repIdNumber = "Representative ID number is required.";
        if (!representativeAuthDoc) {
          errors.representativeAuth = "An Authoritative Note / Authorization Letter from the Vehicle Owner is mandatory for representative applications.";
        }
      }
    }

    if (currentStep === 2) {
      if (!roadworthinessStatus.isValid) {
        errors.roadworthiness = roadworthinessStatus.reason || "Roadworthiness certificate does not meet statutory eligibility cutoff.";
      }
    }

    if (currentStep === 3) {
      if (reason === "Legal Action" && !legalDocument) {
        errors.legalDocument = "A certified Legal Document (Court Injunction, Order, or Statutory Notice) is mandatory when Legal Action is selected.";
      }
      if (!explanation.trim()) {
        errors.explanation = "Detailed statutory explanation for layoff is required.";
      }
      if (!storageFacilityName.trim()) {
        errors.storageFacilityName = "Storage facility / garage location name is required.";
      }
      if (inspectionMethod === "ON_SITE") {
        if (!inspectionSiteAddress.trim()) errors.inspectionSiteAddress = "Vehicle physical location address is required for on-site visit.";
        if (!inspectionSiteArea.trim()) errors.inspectionSiteArea = "Area/Town is required.";
        if (!inspectionContactPhone.trim()) errors.inspectionContactPhone = "Field contact phone number is required.";
      }
    }

    if (currentStep === 4) {
      if (!titleDocument) {
        errors.titleDocument = "Vehicle Registration Document Title is mandatory.";
      }
      if (!photoFront || !photoSide || !photoRear || !photoEngine || !photoChassis) {
        errors.photos = "All five (5) vehicle photographs (Front, Side, Rear, Engine, Chassis) are mandatory.";
      }
    }

    if (currentStep === 5) {
      if (!declarationAgreed) {
        errors.declaration = "You must acknowledge the statutory declaration under Regulation 48.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Final Submission Handler
  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    try {
      const activeApplicantName = applicantType === "REPRESENTATIVE" ? repName : ownerName;
      const activeApplicantPhone = applicantType === "REPRESENTATIVE" ? repPhone : ownerPhone;
      const activeApplicantEmail = applicantType === "REPRESENTATIVE" ? repEmail : ownerEmail;
      const activeIdNumber = applicantType === "REPRESENTATIVE" ? repIdNumber : ownerIdNumber;

      const payload = {
        applicantName: activeApplicantName,
        applicantPhone: activeApplicantPhone,
        applicantEmail: activeApplicantEmail,
        idNumber: activeIdNumber,
        residentialAddress,
        digitalAddress,

        vrsVerified: true,
        applicantType,
        ownerName,
        ownerIdNumber,
        ownerPhone,
        ownerEmail,
        representativeName: applicantType === "REPRESENTATIVE" ? repName : undefined,
        representativePhone: applicantType === "REPRESENTATIVE" ? repPhone : undefined,
        representativeEmail: applicantType === "REPRESENTATIVE" ? repEmail : undefined,
        representativeIdType: applicantType === "REPRESENTATIVE" ? repIdType : undefined,
        representativeIdNumber: applicantType === "REPRESENTATIVE" ? repIdNumber : undefined,
        representativeRelationship: applicantType === "REPRESENTATIVE" ? repRelationship : undefined,
        representativeAddress: applicantType === "REPRESENTATIVE" ? repAddress : undefined,

        registrationNumber,
        chassisNumber,
        engineNumber,
        make,
        model,
        yearOfMake,
        vehicleType,
        colour,

        vehicleUsageClassification,
        roadworthinessExpiryDate,
        isEmergencyMechanicalFailure,

        reason,
        explanation,
        storageFacilityName,
        storageRegion,
        proposedStartDate,
        layoffPeriodMonths,

        inspectionMethod,
        inspectionOfficeLocation: inspectionMethod === "OFFICE" ? inspectionOfficeLocation : undefined,
        inspectionSiteAddress: inspectionMethod === "ON_SITE" ? inspectionSiteAddress : undefined,
        inspectionSiteArea: inspectionMethod === "ON_SITE" ? inspectionSiteArea : undefined,
        inspectionContactPerson: inspectionMethod === "ON_SITE" ? inspectionContactPerson : undefined,
        inspectionContactPhone: inspectionMethod === "ON_SITE" ? inspectionContactPhone : undefined,
        inspectionNotes,

        documents: [
          titleDocument ? { name: titleDocument.name, size: titleDocument.size, type: titleDocument.type, url: titleDocument.previewUrl, category: "document_title" } : null,
          representativeAuthDoc ? { name: representativeAuthDoc.name, size: representativeAuthDoc.size, type: representativeAuthDoc.type, url: representativeAuthDoc.previewUrl, category: "representative_auth" } : null,
          legalDocument ? { name: legalDocument.name, size: legalDocument.size, type: legalDocument.type, url: legalDocument.previewUrl, category: "legal_document" } : null,
          ...additionalDocs.map(d => ({ name: d.name, size: d.size, type: d.type, url: d.previewUrl, category: "document" })),
        ].filter(Boolean),

        mandatoryPhotographs: {
          front: photoFront,
          side: photoSide,
          rear: photoRear,
          engine: photoEngine,
          chassis: photoChassis,
        },

        status: "Pending Verification",
      };

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`Application submission failed: ${errorData.details || errorData.error}`);
        setIsSubmitting(false);
        return;
      }

      const createdApp = await res.json();
      onSuccess(createdApp);
    } catch (err) {
      console.error(err);
      alert("Submission error. Please check your network and retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pt-0 pb-8 px-1 sm:px-4 animate-fade-in">
      {/* Wizard Header Stepper (Compact & Sticky Hovering Progress Bar) */}
      <div className="sticky top-[56px] sm:top-[74px] z-30 mb-4 sm:mb-5 mx-0 sm:-mx-4 lg:-mx-6 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border border-slate-200/90 dark:border-zinc-800/90 rounded-2xl py-2 px-3 sm:py-3 sm:px-8 shadow-md dark:shadow-black/50 transition-all duration-200">
        {/* Mobile Compact Stepper (sm:hidden) */}
        <div className="sm:hidden space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-[#006837] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {currentStep}
              </span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-zinc-100 truncate max-w-[200px]">
                {STEPS[currentStep - 1]?.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {STEPS.map((s) => {
                const isCompleted = currentStep > s.num;
                const isCurrent = currentStep === s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    disabled={!isCompleted && !isCurrent}
                    onClick={() => {
                      if (isCompleted) setCurrentStep(s.num);
                    }}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      isCurrent && "w-5 bg-[#006837] dark:bg-emerald-400",
                      isCompleted && "w-2.5 bg-emerald-600 cursor-pointer",
                      !isCompleted && !isCurrent && "w-2 bg-slate-200 dark:bg-zinc-800"
                    )}
                    aria-label={`Step ${s.num}: ${s.title}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop / Tablet Full 5-Step Stepper (hidden sm:grid) */}
        <div className="hidden sm:grid grid-cols-5 gap-2 sm:gap-4 lg:gap-6">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <button
                key={s.num}
                type="button"
                disabled={!isCompleted && !isCurrent}
                onClick={() => {
                  if (isCompleted) setCurrentStep(s.num);
                }}
                className={cn(
                  "flex flex-col items-center text-center group transition-transform focus:outline-none",
                  isCompleted && "cursor-pointer hover:scale-105 active:scale-95"
                )}
                title={isCompleted ? `Return to Step ${s.num}: ${s.title}` : `Step ${s.num}: ${s.title}`}
              >
                <div
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 rounded-xl flex items-center justify-center transition-all mb-1",
                    isCompleted && "bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700",
                    isCurrent && "bg-[#006837] text-white ring-2 ring-[#006837]/25 shadow-sm scale-105",
                    !isCompleted && !isCurrent && "bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-500"
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" /> : <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                </div>
                <span className={cn(
                  "text-[9px] sm:text-[11px] font-bold truncate max-w-full leading-tight",
                  isCurrent ? "text-[#006837] dark:text-emerald-400 font-extrabold" : "text-slate-500 dark:text-zinc-400",
                  isCompleted && "group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                )}>
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Slim Progress Track */}
        <div className="w-full bg-slate-100 dark:bg-zinc-800/80 h-1 sm:h-1.5 rounded-full mt-1.5 sm:mt-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-600 to-[#006837] dark:to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Form Content */}
      <Card className="border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-8 bg-white dark:bg-[#121212] rounded-2xl sm:rounded-3xl">
        {/* ─── STEP 1: VRS Verification & Ownership ─── */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <Search className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                Step 1: Vehicle Registration System (VRS) Verification
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Enter the vehicle chassis/VIN number to automatically retrieve and verify official DVLA registration details.
              </p>
            </div>

            {/* VIN Input and Verification Strip */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
              <div>
                <Label required>Chassis Number / VIN (Min. 12 Characters)</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-10 pr-3.5 py-2.5 text-sm font-mono font-bold tracking-wider text-slate-900 dark:text-zinc-100 uppercase"
                      placeholder="e.g. JN1AZ34A890123456 or 123456789012"
                      maxLength={17}
                      value={vinInput}
                      onChange={e => {
                        setVinInput(e.target.value.toUpperCase());
                        setIsVrsVerified(false);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleVerifyVRS}
                    disabled={isVerifyingVRS || !vinInput}
                    className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 px-5 h-11 shrink-0"
                  >
                    {isVerifyingVRS ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending SMS OTP...
                      </>
                    ) : isVrsVerified ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        Verified with VRS
                      </>
                    ) : (
                      <>
                        Verify Vehicle with VRS
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                  Clicking <strong className="text-slate-700 dark:text-zinc-300">&ldquo;Verify Vehicle with VRS&rdquo;</strong> will send a 6-digit SMS OTP to the registered owner&apos;s phone to authenticate and unlock vehicle details.
                </p>
                {vrsError && <FieldError message={vrsError} />}
              </div>

              {/* Sample VIN buttons for convenience */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Registered Sample Vehicles in Ghana VRS:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectSampleVIN("JN1AZ34A890123456")}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-emerald-500 text-slate-700 dark:text-zinc-300"
                  >
                    Toyota Corolla (JN1AZ34A890123456)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSampleVIN("123456789012")}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold"
                  >
                    Toyota Hilux 12-char (123456789012)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSampleVIN("JTDKN3DU502918234")}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-emerald-500 text-slate-700 dark:text-zinc-300"
                  >
                    Nissan Patrol SUV (JTDKN3DU502918234)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSampleVIN("1HD1KEM12BB456789")}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-emerald-500 text-slate-700 dark:text-zinc-300"
                  >
                    Scania Heavy Truck (1HD1KEM12BB456789)
                  </button>
                </div>
              </div>
            </div>

            {/* Verified Vehicle Details Banner */}
            {isVrsVerified && (
              <div
                ref={verifiedDataRef}
                className="scroll-mt-36 sm:scroll-mt-40 p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4 animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800 pb-3">
                  <div className="flex items-center gap-2 text-[#006837] dark:text-emerald-400 font-extrabold text-sm">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>VRS Verified: {make} {model} ({registrationNumber})</span>
                  </div>
                  <Badge variant="success" className="text-xs">
                    VRS Authoritative Match
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Registration No:</span>
                    <p className="font-bold text-slate-900 dark:text-zinc-100">{registrationNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Chassis (VIN):</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-zinc-100">{chassisNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Year of Make:</span>
                    <p className="font-bold text-slate-900 dark:text-zinc-100">{yearOfMake}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Colour:</span>
                    <p className="font-bold text-slate-900 dark:text-zinc-100">{colour}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Registered Owner:</span>
                    <p className="font-bold text-slate-900 dark:text-zinc-100">{ownerName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Ghana Card ID:</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-zinc-100">{ownerIdNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Owner Phone:</span>
                    <p className="font-bold text-slate-900 dark:text-zinc-100">{ownerPhone}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Digital Address:</span>
                    <p className="font-bold text-slate-900 dark:text-zinc-100">{digitalAddress || "N/A"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Applicant Type Selection: Owner vs Representative */}
            {isVrsVerified && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <Label required>Applicant Representation Type</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApplicantType("OWNER")}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all flex items-start gap-3",
                      applicantType === "OWNER"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-[#006837] ring-2 ring-[#006837]/20 shadow-xs"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                    )}
                  >
                    <User className={cn("h-5 w-5 mt-0.5", applicantType === "OWNER" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">I am the registered vehicle owner</p>
                      <p className="text-xs text-slate-500 mt-1">Applying directly with the verified owner credentials retrieved from VRS.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setApplicantType("REPRESENTATIVE")}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all flex items-start gap-3",
                      applicantType === "REPRESENTATIVE"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-[#006837] ring-2 ring-[#006837]/20 shadow-xs"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                    )}
                  >
                    <User className={cn("h-5 w-5 mt-0.5", applicantType === "REPRESENTATIVE" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">I am applying on behalf of the owner</p>
                      <p className="text-xs text-slate-500 mt-1">Authorized representative, agent, or fleet manager with Power of Attorney.</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Representative Information Form (Shown only if Representative) */}
            {isVrsVerified && applicantType === "REPRESENTATIVE" && (
              <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span>Representative Information (Separate Entity from Registered Owner)</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Representative details will not overwrite the official VRS registered owner information. Both entities are preserved for administrative scrutiny.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label required>Representative Full Name</Label>
                    <IconInput
                      icon={User}
                      placeholder="e.g. Yaw Boateng"
                      value={repName}
                      onChange={e => setRepName(e.target.value)}
                    />
                    {formErrors.repName && <FieldError message={formErrors.repName} />}
                  </div>

                  <div>
                    <Label required>Representative Phone Number</Label>
                    <IconInput
                      icon={Phone}
                      placeholder="e.g. +233 50 119 2834"
                      value={repPhone}
                      onChange={e => setRepPhone(e.target.value)}
                    />
                    {formErrors.repPhone && <FieldError message={formErrors.repPhone} />}
                  </div>

                  <div>
                    <Label>Representative Email</Label>
                    <IconInput
                      icon={Mail}
                      type="email"
                      placeholder="rep@agency.gh"
                      value={repEmail}
                      onChange={e => setRepEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label required>Identification Type &amp; Number</Label>
                    <div className="flex gap-2">
                      <select
                        className="h-11 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs px-2 text-slate-800 dark:text-zinc-200"
                        value={repIdType}
                        onChange={e => setRepIdType(e.target.value)}
                      >
                        <option>Ghana Card</option>
                        <option>Passport</option>
                        <option>Driver License</option>
                      </select>
                      <input
                        className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-mono font-bold"
                        placeholder="e.g. GHA-882019481-3"
                        value={repIdNumber}
                        onChange={e => setRepIdNumber(e.target.value)}
                      />
                    </div>
                    {formErrors.repIdNumber && <FieldError message={formErrors.repIdNumber} />}
                  </div>

                  <div>
                    <Label>Relationship or Capacity</Label>
                    <IconInput
                      icon={BriefcaseIcon}
                      placeholder="e.g. Fleet Manager / Legal Attorney / Family Member"
                      value={repRelationship}
                      onChange={e => setRepRelationship(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Representative Physical Address</Label>
                    <IconInput
                      icon={Home}
                      placeholder="e.g. Flat 4B, Cantonments Court, Accra"
                      value={repAddress}
                      onChange={e => setRepAddress(e.target.value)}
                    />
                  </div>
                </div>

                {/* Authoritative Note / Authorization Letter from Vehicle Owner (Requirement 1) */}
                <div className="pt-4 border-t border-amber-200 dark:border-amber-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label required>Authoritative Note / Authorization Letter from Vehicle Owner</Label>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Mandatory authorization document from the registered vehicle owner explicitly empowering the representative to act on their behalf.
                      </p>
                    </div>
                    {representativeAuthDoc && (
                      <Badge variant="success" className="text-xs gap-1">
                        <FileCheck className="h-3.5 w-3.5" />
                        Attached
                      </Badge>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={repAuthFileInputRef}
                    onChange={handleUploadRepresentativeAuth}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                  />

                  {representativeAuthDoc ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-800 border border-amber-300 dark:border-zinc-700">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">{representativeAuthDoc.name}</p>
                          <p className="text-[10px] text-slate-500">{representativeAuthDoc.size}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => repAuthFileInputRef.current?.click()}
                          className="text-xs h-8"
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRepresentativeAuthDoc(null)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => repAuthFileInputRef.current?.click()}
                        className="w-full py-4 border border-dashed border-amber-400 dark:border-zinc-700 rounded-xl text-center text-xs font-semibold text-amber-900 dark:text-amber-200 hover:border-amber-600 flex flex-col items-center gap-1 cursor-pointer bg-white/70 dark:bg-zinc-900/60 transition-colors"
                      >
                        <Upload className="h-5 w-5 text-amber-600" />
                        <span className="font-bold">Upload Authoritative Note / Letter of Authorization</span>
                        <span className="text-[10px] text-slate-500">Must authorize representative to submit layoff application (PDF, PNG, JPG up to 10MB)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepresentativeAuthDoc({ id: "rep-doc-sample", name: "Authoritative_Note_Owner_Consent.pdf", size: "1.1 MB", type: "PDF", previewUrl: "/documents/sample_auth.pdf", category: "representative_auth" })}
                        className="text-[11px] text-amber-700 dark:text-amber-400 underline hover:text-amber-900 block text-right cursor-pointer"
                      >
                        Attach sample owner authorization letter
                      </button>
                    </div>
                  )}
                  {formErrors.representativeAuth && <FieldError message={formErrors.representativeAuth} />}
                </div>
              </div>
            )}

            {formErrors.vrs && <FieldError message={formErrors.vrs} />}
          </div>
        )}

        {/* ─── STEP 2: Classification & Roadworthiness ─── */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                Step 2: Vehicle Classification &amp; Roadworthiness Eligibility
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Enforcing strict statutory roadworthiness validity rules (+3 calendar months for Private, +2 calendar months for Commercial).
              </p>
            </div>

            {/* Mandatory Classification */}
            <div className="space-y-2">
              <Label required>Mandatory Vehicle Usage Classification</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setVehicleUsageClassification("Private")}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-start gap-3",
                    vehicleUsageClassification === "Private"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-[#006837] ring-2 ring-[#006837]/20 shadow-xs"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                  )}
                >
                  <Car className={cn("h-5 w-5 mt-0.5", vehicleUsageClassification === "Private" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">Private Vehicle</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Personal saloon cars, domestic SUVs, motorcycles. Requires minimum <strong>3 calendar months</strong> remaining roadworthiness validity.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleUsageClassification("Commercial")}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-start gap-3",
                    vehicleUsageClassification === "Commercial"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-[#006837] ring-2 ring-[#006837]/20 shadow-xs"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                  )}
                >
                  <Car className={cn("h-5 w-5 mt-0.5", vehicleUsageClassification === "Commercial" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">Commercial Vehicle</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Taxis, tro-tros, buses, heavy haulage, commercial trucks. Requires minimum <strong>2 calendar months</strong> remaining roadworthiness validity.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Roadworthiness Certificate Expiry Date */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
              <div>
                <Label required>Roadworthiness Certificate Expiry Date</Label>
                <div className="relative max-w-sm">
                  <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-10 pr-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-zinc-100"
                    value={roadworthinessExpiryDate}
                    onChange={e => setRoadworthinessExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Real-time Strict Cutoff Rule Card */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all text-xs space-y-2",
                roadworthinessStatus.isValid
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    {roadworthinessStatus.isValid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    <span className={roadworthinessStatus.isValid ? "text-emerald-900 dark:text-emerald-200" : "text-red-900 dark:text-red-200"}>
                      {roadworthinessStatus.isValid ? "Vehicle Eligible for Layoff Application" : "Ineligible: Strict Cutoff Rule Violated"}
                    </span>
                  </div>
                  <Badge variant={roadworthinessStatus.isValid ? "success" : "danger"} className="text-[10px]">
                    {roadworthinessStatus.isValid ? "Eligible" : "Ineligible"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800 text-[11px]">
                  <div>
                    <span className="text-slate-500">Application Date:</span>
                    <p className="font-semibold text-slate-800 dark:text-zinc-200">{todayStr}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Statutory Cutoff Date:</span>
                    <p className="font-semibold text-slate-800 dark:text-zinc-200">{roadworthinessStatus.cutoffDate}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Certificate Expiry:</span>
                    <p className="font-semibold text-slate-800 dark:text-zinc-200">{roadworthinessExpiryDate}</p>
                  </div>
                </div>

                {!roadworthinessStatus.isValid && (
                  <p className="text-xs text-red-700 dark:text-red-300 pt-1 font-medium">
                    {roadworthinessStatus.reason}
                  </p>
                )}
              </div>

              {/* Conditional Statutory Emergency Layoff Option */}
              {emergencyEvaluation.hasSufficientValidity ? (
                <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950 dark:text-emerald-100">
                        Standard Statutory Validity Satisfied
                      </p>
                      <p className="text-slate-600 dark:text-zinc-400 text-[11px] mt-0.5">
                        Vehicle certificate possesses at least {emergencyEvaluation.requiredMonths} months of roadworthiness validity remaining (Cutoff: {emergencyEvaluation.cutoffDate}). Standard statutory processing applies without emergency surcharges.
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" className="text-[10px] shrink-0">
                    Standard Eligible
                  </Badge>
                </div>
              ) : (
                <div className={cn(
                  "p-4 rounded-2xl border transition-all space-y-3",
                  isEmergencyMechanicalFailure
                    ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-xs"
                    : "bg-white dark:bg-zinc-800/60 border-amber-200 dark:border-amber-800/60"
                )}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="emergencyLayoffCheckbox"
                      checked={isEmergencyMechanicalFailure}
                      onChange={e => setIsEmergencyMechanicalFailure(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-400 text-[#006837] focus:ring-[#006837] mt-1 cursor-pointer"
                    />
                    <div className="flex-1">
                      <label htmlFor="emergencyLayoffCheckbox" className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 cursor-pointer">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Apply under Statutory Emergency Layoff Provision
                      </label>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                        Your vehicle roadworthiness expires on or before the statutory cutoff ({emergencyEvaluation.cutoffDate}). Under L.I. 2519 Regulation 28, you may proceed only under the emergency layoff provision.
                      </p>
                    </div>
                  </div>

                  {isEmergencyMechanicalFailure && (
                    <div className="pt-3 border-t border-amber-200 dark:border-amber-800/80 text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 dark:text-amber-100">
                          Emergency Layoff Surcharge Applied:
                        </span>
                        <Badge variant="warning" className="text-[11px] font-mono font-bold">
                          + GH₵ {getEmergencyMechanicalFailureFee().toFixed(2)}
                        </Badge>
                      </div>
                      <p className="text-amber-900 dark:text-amber-300">
                        {emergencyEvaluation.reason}
                      </p>
                      <div className="p-2.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-amber-200 dark:border-amber-800 text-[11px] text-slate-600 dark:text-zinc-300">
                        <strong>Decoupled Reason Notice:</strong> You may select any applicable operational reason in Step 3 (e.g., Mechanical Failure, Accident Damage, Commercial Inactivity, Travel/Absence, Legal Action). The emergency classification relates strictly to sub-cutoff roadworthiness validity.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {formErrors.roadworthiness && <FieldError message={formErrors.roadworthiness} />}
          </div>
        )}

        {/* ─── STEP 3: Layoff Details & Inspection Method ─── */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                Step 3: Layoff Details &amp; Inspection Method
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Provide justification, storage facility location, duration, and choose how the vehicle will be presented for inspection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label required>Reason for Statutory Layoff</Label>
                <Select value={reason} onValueChange={(val: any) => setReason(val)}>
                  <SelectTrigger className="h-11 rounded-xl text-xs sm:text-sm font-semibold">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mechanical Failure / Overhaul">Mechanical Failure / Overhaul</SelectItem>
                    <SelectItem value="Legal Action">Legal Action</SelectItem>
                    <SelectItem value="Extended Travel / Absenteeism">Extended Travel / Absenteeism</SelectItem>
                    <SelectItem value="Commercial Inactivity">Commercial Inactivity</SelectItem>
                    <SelectItem value="Vehicle Restoration / Repair">Vehicle Restoration / Repair</SelectItem>
                    <SelectItem value="Other">Other Statutory Rationale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label required>Requested Duration (Months)</Label>
                <Select
                  value={String(layoffPeriodMonths)}
                  onValueChange={(val: any) => setLayoffPeriodMonths(Number(val))}
                >
                  <SelectTrigger className="h-11 rounded-xl text-xs sm:text-sm font-semibold">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Calendar Months</SelectItem>
                    <SelectItem value="6">6 Calendar Months (Standard)</SelectItem>
                    <SelectItem value="9">9 Calendar Months</SelectItem>
                    <SelectItem value="12">12 Calendar Months (Maximum)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Legal Action Mandatory Document Upload (Requirement: show option when Legal Action is selected) */}
              {reason === "Legal Action" && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3 animate-fade-in sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <Label required>Certified Legal Document / Court Order</Label>
                        <p className="text-xs text-indigo-900/80 dark:text-indigo-300">
                          Court Injunction, Seizure Warrant, Police Notice, or Litigation Order justifying statutory vehicle immobilisation under Regulation 48.
                        </p>
                      </div>
                    </div>
                    {legalDocument && (
                      <Badge variant="success" className="text-xs gap-1">
                        <FileCheck className="h-3.5 w-3.5" />
                        Attached
                      </Badge>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={legalDocFileInputRef}
                    onChange={handleUploadLegalDoc}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="hidden"
                  />

                  {legalDocument ? (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-800 border border-indigo-300 dark:border-zinc-700 shadow-xs">
                      <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">{legalDocument.name}</p>
                          <p className="text-[10px] text-slate-500">{legalDocument.size} • Certified Legal Document</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => legalDocFileInputRef.current?.click()}
                          className="text-xs h-8"
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLegalDocument(null)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => legalDocFileInputRef.current?.click()}
                        className="w-full py-4 border-2 border-dashed border-indigo-300 dark:border-indigo-700/60 rounded-xl text-center text-xs font-semibold text-indigo-950 dark:text-indigo-200 hover:border-indigo-500 flex flex-col items-center gap-1.5 cursor-pointer bg-white/80 dark:bg-zinc-900/60 transition-colors"
                      >
                        <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold">Upload Certified Legal Document / Court Order</span>
                        <span className="text-[10px] text-slate-500">PDF, PNG, JPG, or DOC format (up to 10MB)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLegalDocument({
                            id: "legal-doc-sample",
                            name: "High_Court_Injunction_Order_Suit_No_GJ_142.pdf",
                            size: "2.4 MB",
                            type: "PDF",
                            previewUrl: "/documents/sample_court_order.pdf",
                            category: "legal_document"
                          });
                          setFormErrors(prev => {
                            const next = { ...prev };
                            delete next.legalDocument;
                            return next;
                          });
                        }}
                        className="text-[11px] text-indigo-700 dark:text-indigo-400 underline hover:text-indigo-900 block text-right cursor-pointer"
                      >
                        Attach sample Court Injunction Order (PDF)
                      </button>
                    </div>
                  )}
                  {formErrors.legalDocument && <FieldError message={formErrors.legalDocument} />}
                </div>
              )}

              <div className="sm:col-span-2">
                <Label required>Detailed Explanation of Immobilisation &amp; Inactivity</Label>
                <textarea
                  className="w-full h-24 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Provide comprehensive details of mechanical breakdown, workshop overhaul, or reasons vehicle will be immobilized..."
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                />
                {formErrors.explanation && <FieldError message={formErrors.explanation} />}
              </div>

              <div>
                <Label required>Storage Facility / Garage Name</Label>
                <IconInput
                  icon={Building2}
                  placeholder="e.g. Suame Magazine Master Auto Workshop"
                  value={storageFacilityName}
                  onChange={e => setStorageFacilityName(e.target.value)}
                />
                {formErrors.storageFacilityName && <FieldError message={formErrors.storageFacilityName} />}
              </div>

              <div>
                <Label required>Storage Administrative Region</Label>
                <Select value={storageRegion} onValueChange={setStorageRegion}>
                  <SelectTrigger className="h-11 rounded-xl text-xs sm:text-sm font-semibold">
                    <SelectValue placeholder="Select Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Greater Accra">Greater Accra</SelectItem>
                    <SelectItem value="Ashanti">Ashanti</SelectItem>
                    <SelectItem value="Western">Western</SelectItem>
                    <SelectItem value="Eastern">Eastern</SelectItem>
                    <SelectItem value="Central">Central</SelectItem>
                    <SelectItem value="Northern">Northern</SelectItem>
                    <SelectItem value="Volta">Volta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Inspection Method Selection (Section 6) */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <Label required>Technical Inspection Method</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setInspectionMethod("OFFICE")}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-start gap-3",
                    inspectionMethod === "OFFICE"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-[#006837] ring-2 ring-[#006837]/20 shadow-xs"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                  )}
                >
                  <Building2 className={cn("h-5 w-5 mt-0.5", inspectionMethod === "OFFICE" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">Option A: Bring Vehicle to DVLA Office</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Present vehicle at an authorized DVLA testing center or regional office for physical technical inspection.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectionMethod("ON_SITE")}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-start gap-3",
                    inspectionMethod === "ON_SITE"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border-[#006837] ring-2 ring-[#006837]/20 shadow-xs"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                  )}
                >
                  <MapPin className={cn("h-5 w-5 mt-0.5", inspectionMethod === "ON_SITE" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">Option B: Request On-Site Inspection (At a fee)</p>
                    <p className="text-xs text-slate-500 mt-1">
                      A DVLA technical officer visits the immobilised vehicle's garage or premises. Additional field fee applies.
                    </p>
                  </div>
                </button>
              </div>

              {/* Office Selection Details */}
              {inspectionMethod === "OFFICE" && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                  <Label required>Selected DVLA Inspection Office</Label>
                  <Select value={inspectionOfficeLocation} onValueChange={setInspectionOfficeLocation}>
                    <SelectTrigger className="h-11 rounded-xl text-xs sm:text-sm font-semibold">
                      <SelectValue placeholder="Select Office" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DVLA 37 Head Office - Accra">DVLA 37 Head Office - Accra</SelectItem>
                      <SelectItem value="DVLA Tema Regional Station">DVLA Tema Regional Station</SelectItem>
                      <SelectItem value="DVLA Kumasi Regional Station">DVLA Kumasi Regional Station</SelectItem>
                      <SelectItem value="DVLA Takoradi Regional Station">DVLA Takoradi Regional Station</SelectItem>
                      <SelectItem value="DVLA Tamale Testing Station">DVLA Tamale Testing Station</SelectItem>
                      {availableStations.map((s) => (
                        <SelectItem key={s.id} value={`${s.name} (${s.region})`}>
                          {s.name} ({s.region})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* On-Site Inspection Details Form */}
              {inspectionMethod === "ON_SITE" && (
                <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                    <MapPin className="h-4 w-4 text-amber-600" />
                    <span>On-Site Premises Visit Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Label required>Vehicle Physical Location Address</Label>
                      <IconInput
                        icon={MapPin}
                        placeholder="e.g. Plot 12 Heavy Industrial Area, Warehouse 4"
                        value={inspectionSiteAddress}
                        onChange={e => setInspectionSiteAddress(e.target.value)}
                      />
                      {formErrors.inspectionSiteAddress && <FieldError message={formErrors.inspectionSiteAddress} />}
                    </div>

                    <div>
                      <Label required>Area / Town / Suburb</Label>
                      <IconInput
                        icon={Home}
                        placeholder="e.g. Tema Industrial Area"
                        value={inspectionSiteArea}
                        onChange={e => setInspectionSiteArea(e.target.value)}
                      />
                      {formErrors.inspectionSiteArea && <FieldError message={formErrors.inspectionSiteArea} />}
                    </div>

                    <div>
                      <Label required>On-Site Contact Person Name</Label>
                      <IconInput
                        icon={User}
                        placeholder="e.g. Workshop Supervisor Mensah"
                        value={inspectionContactPerson}
                        onChange={e => setInspectionContactPerson(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label required>Contact Telephone Number</Label>
                      <IconInput
                        icon={Phone}
                        placeholder="e.g. +233 20 551 0928"
                        value={inspectionContactPhone}
                        onChange={e => setInspectionContactPhone(e.target.value)}
                      />
                      {formErrors.inspectionContactPhone && <FieldError message={formErrors.inspectionContactPhone} />}
                    </div>

                    <div>
                      <Label>Additional Directions / Location Notes</Label>
                      <IconInput
                        icon={FileText}
                        placeholder="e.g. Behind Shell filling station, Gate 2"
                        value={inspectionNotes}
                        onChange={e => setInspectionNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 4: Evidence & Five Mandatory Photographs ─── */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                Step 4: Vehicle Registration Document Title &amp; 5 Mandatory Photographs
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Upload official registration title and all five designated initial vehicle photographs.
              </p>
            </div>

            {/* Vehicle Registration Document Title (Section 5.1 Label Update) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label required>Vehicle Registration Document Title</Label>
                  <p className="text-xs text-slate-500">Official DVLA Certificate of Title or Logbook</p>
                </div>
                {titleDocument && (
                  <Badge variant="success" className="text-xs gap-1">
                    <FileCheck className="h-3.5 w-3.5" />
                    Attached
                  </Badge>
                )}
              </div>

              {titleDocument ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">{titleDocument.name}</p>
                      <p className="text-[10px] text-slate-500">{titleDocument.size}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTitleDocument(null)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTitleDocument({ id: "doc-1", name: "Vehicle_Registration_Document_Title.pdf", size: "2.1 MB", type: "PDF", category: "document_title" })}
                  className="w-full py-4 border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl text-center text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:border-emerald-500 flex flex-col items-center gap-1"
                >
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span>Click to Upload Vehicle Registration Document Title</span>
                </button>
              )}
              {formErrors.titleDocument && <FieldError message={formErrors.titleDocument} />}
            </div>

            {/* Five Mandatory Vehicle Photographs (Section 5.2) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label required>Five (5) Mandatory Vehicle Photographs</Label>
                  <p className="text-xs text-slate-500">
                    Each designated view must be submitted. Technical officer inspection photographs will be recorded separately.
                  </p>
                </div>
                <Badge variant="info" className="text-xs">
                  5 Categories Required
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                {[
                  { label: "1. Front View", state: photoFront, setter: setPhotoFront, defaultUrl: "/placeholder-car-front.jpg" },
                  { label: "2. Side View", state: photoSide, setter: setPhotoSide, defaultUrl: "/placeholder-car-side.jpg" },
                  { label: "3. Rear View", state: photoRear, setter: setPhotoRear, defaultUrl: "/placeholder-car-rear.jpg" },
                  { label: "4. Engine Bay", state: photoEngine, setter: setPhotoEngine, defaultUrl: "/placeholder-car-engine.jpg" },
                  { label: "5. Chassis / VIN", state: photoChassis, setter: setPhotoChassis, defaultUrl: "/placeholder-car-chassis.jpg" },
                ].map((slot, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-2.5 sm:p-3 text-center bg-slate-50 dark:bg-zinc-900 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-extrabold text-slate-700 dark:text-zinc-300 mb-1.5 line-clamp-1">{slot.label}</p>
                      <div className="h-18 sm:h-20 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-400 mb-2 relative overflow-hidden">
                        {slot.state ? (
                          <div className="flex flex-col items-center text-[#006837] dark:text-emerald-400 font-bold text-[10px]">
                            <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 mb-1 text-emerald-600" />
                            <span>Attached</span>
                          </div>
                        ) : (
                          <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => slot.setter(slot.defaultUrl)}
                      className="text-[10px] sm:text-[11px] h-8 w-full rounded-xl font-bold"
                    >
                      {slot.state ? "Replace Photo" : "Upload Photo"}
                    </Button>
                  </div>
                ))}
              </div>
              {formErrors.photos && <FieldError message={formErrors.photos} />}
            </div>
          </div>
        )}

        {/* ─── STEP 5: Statutory Declaration & Review ─── */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                Step 5: Review &amp; Statutory Declaration
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Carefully review all submitted particulars before recording final legal submission.
              </p>
            </div>

            {/* Summary Grid */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Registration Number</span>
                <p className="font-extrabold text-slate-900 dark:text-zinc-100 text-sm">{registrationNumber}</p>
              </div>
              <div>
                <span className="text-slate-500">Chassis / VIN</span>
                <p className="font-mono font-bold text-slate-900 dark:text-zinc-100">{chassisNumber}</p>
              </div>
              <div>
                <span className="text-slate-500">Applicant Entity</span>
                <p className="font-bold text-slate-900 dark:text-zinc-100">
                  {applicantType === "REPRESENTATIVE" ? `${repName} (Rep)` : ownerName}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Registered Owner</span>
                <p className="font-bold text-slate-900 dark:text-zinc-100">{ownerName}</p>
              </div>
              <div>
                <span className="text-slate-500">Classification</span>
                <p className="font-bold">{vehicleUsageClassification}</p>
              </div>
              <div>
                <span className="text-slate-500">Inspection Method</span>
                <p className="font-bold text-[#006837] dark:text-emerald-400">
                  {inspectionMethod === "ON_SITE" ? "On-Site Premises Visit" : "Office Testing Center"}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Layoff Duration</span>
                <p className="font-bold">{layoffPeriodMonths} Calendar Months</p>
              </div>
              <div>
                <span className="text-slate-500">Reason</span>
                <p className="font-bold">{reason}</p>
              </div>
            </div>

            {/* Estimated Statutory Fees & Surcharges Breakdown (Requirement 3) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                <span className="text-xs font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                  Payable Fee Breakdown (IPP Pro Statutory Invoice)
                </span>
                <Badge variant="info" className="text-[10px]">
                  Estimated Total
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Base Statutory Layoff Application Fee</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-zinc-200">
                    GH₵ {estimatedFeeBreakdown.baseFee.toFixed(2)}
                  </span>
                </div>

                {estimatedFeeBreakdown.onSiteFee > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span>On-Site Inspection Field Fee</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-zinc-200">
                      GH₵ {estimatedFeeBreakdown.onSiteFee.toFixed(2)}
                    </span>
                  </div>
                )}

                {estimatedFeeBreakdown.emergencyFee > 0 ? (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400 font-medium">
                    <div>
                      <span>Emergency Mechanical Failure Surcharge</span>
                      <p className="text-[10px] text-amber-600/90 dark:text-amber-400/80 font-normal">
                        Applied because roadworthiness validity is below the statutory threshold (&lt; {vehicleUsageClassification === "Private" ? "3" : "2"} months).
                      </p>
                    </div>
                    <span className="font-mono font-bold">
                      + GH₵ {estimatedFeeBreakdown.emergencyFee.toFixed(2)}
                    </span>
                  </div>
                ) : isEmergencyMechanicalFailure ? (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 text-[11px]">
                    <span>Emergency Surcharge Exemption</span>
                    <span className="font-semibold">GH₵ 0.00 (Roadworthiness validity &ge; {vehicleUsageClassification === "Private" ? "3" : "2"} months)</span>
                  </div>
                ) : null}

                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center text-sm font-extrabold text-[#006837] dark:text-emerald-400">
                  <span>Total Amount Payable</span>
                  <span className="text-base font-mono">
                    GH₵ {estimatedFeeBreakdown.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Legally Defensible Statutory Declaration (L.I. 2519 Regulation 28) */}
            <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-3.5">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs">
                <ShieldCheck className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
                <span>Statutory Undertaking Pursuant to Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28</span>
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="statutoryDeclaration"
                  checked={declarationAgreed}
                  onChange={e => setDeclarationAgreed(e.target.checked)}
                  className="h-4 w-4 rounded border-emerald-400 text-[#006837] focus:ring-[#006837] mt-1 cursor-pointer"
                />
                <label htmlFor="statutoryDeclaration" className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed font-medium cursor-pointer space-y-1 block">
                  <span>
                    I solemnly declare that the particulars submitted are accurate and complete. I formally undertake that:
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 dark:text-zinc-400">
                    <li>The vehicle shall remain immobilized and strictly <strong>OFF public roads</strong> during the entire statutory layoff period.</li>
                    <li>The vehicle registration certificate is surrendered / cancelled for road use under <strong>Regulation 28</strong>.</li>
                    <li>If the vehicle is operated on any public road during the layoff period, I am liable under <strong>Regulation 28(3)</strong> to pay all accrued road licensing and testing charges, without prejudice to prosecution and penalties under <strong>Regulation 243</strong>.</li>
                    <li>An authorized vehicle inspector or police Officer possess full statutory right to inspect the vehicle at the declared storage facility.</li>
                    <li>Statutory off-road status becomes legally effective only upon verified invoice payment.</li>
                  </ul>
                </label>
              </div>
              {formErrors.declaration && <FieldError message={formErrors.declaration} />}
            </div>
          </div>
        )}

        {/* Wizard Navigation Footer */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-6 border-t border-slate-100 dark:border-zinc-800 mt-6">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold gap-2 w-full sm:w-auto h-11 sm:h-10 justify-center"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous Step
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="rounded-xl text-xs font-bold w-full sm:w-auto h-11 sm:h-10 justify-center"
            >
              Cancel
            </Button>
          )}

          {currentStep < 5 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 px-6 w-full sm:w-auto h-11 sm:h-10 justify-center shadow-xs"
            >
              Continue to Step {currentStep + 1}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-2 px-6 sm:px-8 w-full sm:w-auto h-11 sm:h-10 justify-center shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Recording Statutory Submission...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Submit Official Layoff Application
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      {/* VRS Security Verification OTP Modal */}
      <VRSOTPModal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        vin={otpTargetVin}
        maskedPhone={otpMaskedPhone}
        vehicleSummary={otpVehicleSummary}
        simulatedOtp={otpSimulatedCode}
        onVerified={handleVrsOtpVerified}
        onResendOtp={handleResendVrsOtp}
      />
    </div>
  );
}

function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
