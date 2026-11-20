"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Wrench, Car, MapPin, Phone, User, Calendar, CheckCircle2,
  AlertTriangle, Camera, Upload, FileText, Search, Filter,
  Clock, ShieldCheck, ArrowRight, Eye, Layers, Building2,
  RefreshCw, FileCheck, X, Trash2, CameraOff, Video,
  Check, RotateCcw, AlertCircle, CalendarCheck, Shield,
  ExternalLink, Sparkles, AlertOctagon, HelpCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LayoffApplication } from "@/lib/mock-data";
import { StatutoryCertificate } from "@/components/statutory-certificate";
import { isClaimExpired, getClaimSlaRemaining } from "@/lib/claim-sla";

interface TechnicalOfficerDashboardProps {
  applications: LayoffApplication[];
  currentUser?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    region?: string;
    stationLocation?: string;
    staffId?: string | null;
    phone?: string;
  } | null;
  activeSection?: string;
  onSelectSection?: (sectionId: string) => void;
  onRefreshData?: () => void;
  onInspectionSubmitted?: (updatedApp: LayoffApplication) => void;
}

// 5 Prescribed On-Site Inspection Photo Categories
export const INSPECTION_PHOTO_CATEGORIES = [
  { key: "front", label: "1. Front View", description: "Clear front view showing vehicle face and registration plate" },
  { key: "side", label: "2. Side Profile", description: "Full side profile showing body panels and wheels" },
  { key: "rear", label: "3. Rear View", description: "Full rear view showing exhaust, rear lights and plate" },
  { key: "engine", label: "4. Engine Compartment", description: "Open bonnet view showing engine block and components" },
  { key: "chassis", label: "5. Stamped Chassis No.", description: "Close-up of stamped chassis number on firewall/door pillar" },
] as const;

type PhotoCategoryKey = typeof INSPECTION_PHOTO_CATEGORIES[number]["key"];

interface CapturedPhotoItem {
  categoryKey: PhotoCategoryKey;
  categoryLabel: string;
  dataUrl: string;
  capturedAt: string;
}

export function TechnicalOfficerDashboard({
  applications,
  currentUser,
  activeSection = "workspace",
  onSelectSection,
  onRefreshData,
  onInspectionSubmitted,
}: TechnicalOfficerDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("All");
  const [selectedApp, setSelectedApp] = useState<LayoffApplication | null>(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);

  // Vehicle Status Lookup tab state
  const [vehicleLookupQuery, setVehicleLookupQuery] = useState("");
  const [certificateModalApp, setCertificateModalApp] = useState<LayoffApplication | null>(null);

  // Claiming / Unclaiming state
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [unclaimingId, setUnclaimingId] = useState<string | null>(null);
  const [unclaimTargetApp, setUnclaimTargetApp] = useState<LayoffApplication | null>(null);
  const [unclaimReason, setUnclaimReason] = useState("");
  const [claimFeedback, setClaimFeedback] = useState<{ type: "success" | "error"; title?: string; message: string } | null>(null);

  // Auto-dismiss toast after 4.5 seconds
  useEffect(() => {
    if (!claimFeedback) return;
    const timer = setTimeout(() => {
      setClaimFeedback(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [claimFeedback]);

  // Follow-up state & Active Inspections switcher (default: ACTIVE)
  const [followUpRecords, setFollowUpRecords] = useState<any[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [activeInspectionTab, setActiveInspectionTab] = useState<"ACTIVE" | "FOLLOW_UP">("ACTIVE");
  const [selectedFollowUp, setSelectedFollowUp] = useState<any | null>(null);
  const [previousInspectionModal, setPreviousInspectionModal] = useState<any | null>(null);

  // Inspection form states
  const officerName = currentUser?.fullName || "Ing. Samuel Annan (TO-409)";
  const officerPhone = currentUser?.phone || "+233 24 987 6543";
  const officerRegion = currentUser?.region || "Greater Accra";
  const stationLocation = currentUser?.stationLocation || "DVLA 37 Head Office";

  const [findings, setFindings] = useState("");
  const [defects, setDefects] = useState("");
  const [outcome, setOutcome] = useState<"Inspection completed successfully" | "Inspection completed with issues" | "Further inspection or information required">("Inspection completed successfully");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inspectionFormError, setInspectionFormError] = useState<string | null>(null);

  // Camera states
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, CapturedPhotoItem>>({});
  const [activeCameraCategory, setActiveCameraCategory] = useState<PhotoCategoryKey | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Post-submission report upload states
  const [reportModalApp, setReportModalApp] = useState<LayoffApplication | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [isUploadingReport, setIsUploadingReport] = useState(false);
  const [reportUploadError, setReportUploadError] = useState<string | null>(null);
  const [reportUploadSuccess, setReportUploadSuccess] = useState<string | null>(null);

  // Load follow-ups
  const loadFollowUps = async () => {
    setFollowUpLoading(true);
    try {
      const res = await fetch(`/api/inspections/follow-up?region=${encodeURIComponent(officerRegion)}`);
      if (res.ok) {
        const data = await res.json();
        setFollowUpRecords(data.requiredFollowUps || []);
      }
    } catch (err) {
      console.error("Failed to load follow-ups:", err);
    } finally {
      setFollowUpLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, [officerRegion]);

  // Clean up camera stream
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setActiveCameraCategory(null);
    setCameraError(null);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // ─── REGIONAL CLASSIFICATION & DATA FILTERING ───
  const officerRegionNorm = officerRegion.trim().toLowerCase();

  // Regional pool: Approved by admin, not yet assigned (or auto-released after 4 days), matches officer region
  const regionalPool = useMemo(() => {
    return applications.filter(app => {
      const appRegionNorm = (app.storageRegion || "greater accra").trim().toLowerCase();
      const isMyRegion = appRegionNorm === officerRegionNorm || !app.storageRegion;
      const isApproved = app.adminApprovalStatus === "Approved";
      const isSlaExpired = app.inspectionStatus !== "Completed" && isClaimExpired(app.claimedAt);
      const isUnclaimed =
        !app.assignedOfficerId || app.inspectionStatus === "Pending Assignment" || isSlaExpired;
      return isMyRegion && isApproved && isUnclaimed;
    });
  }, [applications, officerRegionNorm]);

  // My active inspections: assigned to me, status In Progress, and within the 4-day claim window
  const myActiveInspections = useMemo(() => {
    return applications.filter(app => {
      const isAssignedToMe =
        (currentUser && app.assignedOfficerId === currentUser.id) ||
        (currentUser && app.assignedOfficerName === currentUser.fullName) ||
        app.assignedOfficerName?.includes("Samuel Annan") ||
        (app.assignedOfficerId && !currentUser);

      const isInProgress = app.inspectionStatus === "In Progress" || app.inspectionStatus === "Assigned";
      const isSlaExpired = isClaimExpired(app.claimedAt);
      return isAssignedToMe && isInProgress && !isSlaExpired;
    });
  }, [applications, currentUser]);

  // Completed inspections
  const myCompletedInspections = useMemo(() => {
    return applications.filter(app => {
      const isAssignedToMe =
        (currentUser && app.assignedOfficerId === currentUser.id) ||
        (currentUser && app.assignedOfficerName === currentUser.fullName) ||
        app.assignedOfficerName?.includes("Samuel Annan") ||
        (app.assignedOfficerId && !currentUser);

      return isAssignedToMe && app.inspectionStatus === "Completed";
    });
  }, [applications, currentUser]);

  // My Active Follow-Up Inspections (claimed follow-up cases in progress)
  const myActiveFollowUps = useMemo(() => {
    return followUpRecords.filter(item => {
      const isInProgress = item.followUpStatus === "In Progress";
      const isAssignedToMe =
        !item.followUpOfficerId ||
        (currentUser && item.followUpOfficerId === currentUser.id) ||
        (currentUser && item.followUpOfficerName === currentUser.fullName) ||
        item.followUpOfficerName?.includes("Samuel Annan") ||
        !currentUser;
      return isInProgress && isAssignedToMe;
    });
  }, [followUpRecords, currentUser]);

  // Filter Follow-Up list based on search
  const filterFollowUps = (list: any[]) => {
    return list.filter(item => {
      const q = searchTerm.toLowerCase();
      if (!q) return true;
      return (
        (item.applicationId || "").toLowerCase().includes(q) ||
        (item.registrationNumber || "").toLowerCase().includes(q) ||
        (item.chassisNumber || "").toLowerCase().includes(q) ||
        (item.applicantName || "").toLowerCase().includes(q) ||
        (item.previousOfficerName || "").toLowerCase().includes(q)
      );
    });
  };

  // Filter application list based on search and method
  const filterList = (list: LayoffApplication[]) => {
    return list.filter(app => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        app.id.toLowerCase().includes(q) ||
        app.registrationNumber.toLowerCase().includes(q) ||
        app.chassisNumber.toLowerCase().includes(q) ||
        app.applicantName.toLowerCase().includes(q);

      const matchMethod =
        methodFilter === "All" ||
        (methodFilter === "OFFICE" && app.inspectionMethod === "OFFICE") ||
        (methodFilter === "ON_SITE" && app.inspectionMethod === "ON_SITE");

      return matchSearch && matchMethod;
    });
  };

  // ─── ATOMIC CLAIM INSPECTION ───
  const handleClaimInspection = async (appId: string) => {
    setClaimingId(appId);
    setClaimFeedback(null);
    try {
      const res = await fetch(`/api/applications/${appId}/claim`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        setClaimFeedback({
          type: "success",
          message: data.message || `Case successfully claimed. Applicant notified via SMS.`,
        });
        if (data.application && onInspectionSubmitted) onInspectionSubmitted(data.application);
        if (onRefreshData) onRefreshData();
        // Automatically switch to my-inspections tab
        if (onSelectSection) onSelectSection("my-inspections");
      } else {
        setClaimFeedback({
          type: "error",
          message: data.details || data.error || "Failed to claim inspection case.",
        });
      }
    } catch (err) {
      console.error(err);
      setClaimFeedback({
        type: "error",
        message: "Network error occurred while claiming inspection.",
      });
    } finally {
      setClaimingId(null);
    }
  };

  // ─── ATOMIC UNCLAIM INSPECTION (MODAL + TOAST) ───
  const handlePromptUnclaim = (app: LayoffApplication) => {
    setUnclaimTargetApp(app);
    setUnclaimReason("");
  };

  const handleConfirmUnclaim = async () => {
    if (!unclaimTargetApp) return;
    const appId = unclaimTargetApp.id;

    setUnclaimingId(appId);
    setClaimFeedback(null);
    try {
      const res = await fetch(`/api/applications/${appId}/unclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: unclaimReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setClaimFeedback({
          type: "success",
          title: "Case Unclaimed",
          message: data.message || `Inspection for ${unclaimTargetApp.registrationNumber} released back to the regional pool.`,
        });
        if (data.application && onInspectionSubmitted) {
          onInspectionSubmitted(data.application);
        }
        setUnclaimTargetApp(null);
        setUnclaimReason("");
        if (selectedApp?.id === appId) {
          handleCloseInspectionModal();
        }
        if (onRefreshData) onRefreshData();
      } else {
        setClaimFeedback({
          type: "error",
          title: "Unclaim Failed",
          message: data.details || data.error || "Failed to unclaim inspection case.",
        });
      }
    } catch (err) {
      console.error(err);
      setClaimFeedback({
        type: "error",
        title: "Network Error",
        message: "Network error occurred while unclaiming inspection.",
      });
    } finally {
      setUnclaimingId(null);
    }
  };

  // ─── CLAIM / UNCLAIM STATUTORY FOLLOW-UP ───
  const handleClaimFollowUp = async (appId: string) => {
    setSchedulingId(appId);
    try {
      const res = await fetch("/api/inspections/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          action: "CLAIM",
          notes: "Follow-up case claimed by Technical Officer for re-verification.",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setClaimFeedback({
          type: "success",
          title: "Follow-Up Case Claimed",
          message: data.message || "Follow-up inspection case claimed and moved to Follow-Up Inspections under My Active Inspections.",
        });
        await loadFollowUps();
        if (onRefreshData) onRefreshData();
        setActiveInspectionTab("FOLLOW_UP");
        if (onSelectSection) onSelectSection("my-inspections");
      } else {
        setClaimFeedback({
          type: "error",
          title: "Claim Failed",
          message: data.error || "Failed to claim follow-up inspection.",
        });
      }
    } catch (err) {
      console.error(err);
      setClaimFeedback({
        type: "error",
        title: "Network Error",
        message: "Error claiming follow-up case.",
      });
    } finally {
      setSchedulingId(null);
    }
  };

  const handleUnclaimFollowUp = async (appId: string) => {
    setSchedulingId(appId);
    try {
      const res = await fetch("/api/inspections/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          action: "UNCLAIM",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setClaimFeedback({
          type: "success",
          title: "Follow-Up Released",
          message: data.message || "Follow-up case released back into the Follow-Up pool.",
        });
        await loadFollowUps();
        if (onRefreshData) onRefreshData();
      } else {
        setClaimFeedback({
          type: "error",
          title: "Release Failed",
          message: data.error || "Failed to release follow-up case.",
        });
      }
    } catch (err) {
      console.error(err);
      setClaimFeedback({
        type: "error",
        title: "Network Error",
        message: "Error releasing follow-up case.",
      });
    } finally {
      setSchedulingId(null);
    }
  };

  // ─── INSPECTION MODAL OPEN (INITIAL OR FOLLOW-UP) ───
  const handleOpenInspection = (app: LayoffApplication) => {
    setSelectedFollowUp(null);
    setSelectedApp(app);
    setFindings(app.inspectionFindings || "");
    setDefects(app.inspectionDefects || "");
    setOutcome(app.inspectionOutcome || "Inspection completed successfully");
    setInspectionFormError(null);

    const initialMap: Record<string, CapturedPhotoItem> = {};
    if (app.inspectionPhotos && app.inspectionPhotos.length > 0) {
      INSPECTION_PHOTO_CATEGORIES.forEach((cat, idx) => {
        if (app.inspectionPhotos && app.inspectionPhotos[idx]) {
          initialMap[cat.key] = {
            categoryKey: cat.key,
            categoryLabel: cat.label,
            dataUrl: app.inspectionPhotos[idx],
            capturedAt: app.inspectionDate || new Date().toISOString(),
          };
        }
      });
    }
    setCapturedPhotos(initialMap);
    setIsInspectionModalOpen(true);
  };

  const handleOpenFollowUpInspection = (followUpItem: any) => {
    const matchedApp = applications.find(a => a.id === followUpItem.applicationId);
    const appObj: LayoffApplication = matchedApp || ({
      id: followUpItem.applicationId,
      registrationNumber: followUpItem.registrationNumber,
      chassisNumber: followUpItem.chassisNumber || "N/A",
      make: followUpItem.make,
      model: followUpItem.model,
      yearOfMake: followUpItem.yearOfMake || "2022",
      color: followUpItem.color || "Silver",
      applicantName: followUpItem.applicantName,
      applicantPhone: followUpItem.applicantPhone,
      storageRegion: followUpItem.storageRegion,
      inspectionMethod: followUpItem.inspectionMethod || "ON_SITE",
      inspectionSiteAddress: followUpItem.inspectionSiteAddress,
      inspectionSiteArea: followUpItem.inspectionSiteArea,
      inspectionOfficeLocation: followUpItem.inspectionOfficeLocation,
      inspectionStatus: followUpItem.followUpStatus === "Completed" ? "Completed" : "In Progress",
    } as unknown as LayoffApplication);

    setSelectedFollowUp(followUpItem);
    setSelectedApp(appObj);
    setFindings(followUpItem.followUpFindings || "");
    setDefects(followUpItem.followUpDefects || "");
    setOutcome(followUpItem.followUpOutcome || "Inspection completed successfully");
    setInspectionFormError(null);

    const initialMap: Record<string, CapturedPhotoItem> = {};
    if (followUpItem.followUpPhotos && followUpItem.followUpPhotos.length > 0) {
      INSPECTION_PHOTO_CATEGORIES.forEach((cat, idx) => {
        if (followUpItem.followUpPhotos && followUpItem.followUpPhotos[idx]) {
          initialMap[cat.key] = {
            categoryKey: cat.key,
            categoryLabel: cat.label,
            dataUrl: followUpItem.followUpPhotos[idx],
            capturedAt: followUpItem.followUpConductedAt || new Date().toISOString(),
          };
        }
      });
    }
    setCapturedPhotos(initialMap);
    setIsInspectionModalOpen(true);
  };

  const handleCloseInspectionModal = () => {
    stopCameraStream();
    setIsInspectionModalOpen(false);
    setSelectedApp(null);
    setSelectedFollowUp(null);
  };

  // ─── START CAMERA FOR CATEGORY ───
  const handleStartCameraForCategory = async (categoryKey: PhotoCategoryKey) => {
    setCameraError(null);
    setActiveCameraCategory(categoryKey);
    setIsStartingCamera(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera API is not supported by your browser or environment. On-site camera capture requires a secure context (HTTPS) and camera hardware."
      );
      setIsStartingCamera(false);
      return;
    }

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      let errorMsg = "Unable to access camera on this device.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Camera permission was denied. You must grant camera access to capture mandatory on-site inspection photographs.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No camera device found. Connect a camera or use an authorized inspection mobile device.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMsg = "Camera hardware is currently in use by another application.";
      }
      setCameraError(errorMsg);
    } finally {
      setIsStartingCamera(false);
    }
  };

  // ─── SHUTTER CAPTURE SNAPSHOT ───
  const handleCaptureSnapshot = () => {
    if (!activeCameraCategory) return;
    const cat = INSPECTION_PHOTO_CATEGORIES.find(c => c.key === activeCameraCategory);
    if (!cat) return;

    let snapshotUrl = "";

    if (videoRef.current && canvasRef.current && isCameraActive) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Statutory Watermark with timestamp, reg, and officer
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px monospace";
        ctx.fillText(
          `DVLA ON-SITE: ${selectedApp?.registrationNumber || ""} | ${cat.label} | ${new Date().toISOString().slice(0, 19)}`,
          12,
          canvas.height - 12
        );
        snapshotUrl = canvas.toDataURL("image/jpeg", 0.85);
      }
    }

    if (!snapshotUrl) {
      snapshotUrl = `/api/uploads/OnSite_${activeCameraCategory}_${Date.now()}.jpg`;
    }

    const now = new Date().toISOString();
    setCapturedPhotos(prev => ({
      ...prev,
      [activeCameraCategory]: {
        categoryKey: activeCameraCategory,
        categoryLabel: cat.label,
        dataUrl: snapshotUrl,
        capturedAt: now,
      },
    }));

    stopCameraStream();
  };

  // ─── SIMULATED TEST CAPTURE ───
  const handleSimulateCaptureForCategory = (categoryKey: PhotoCategoryKey) => {
    const cat = INSPECTION_PHOTO_CATEGORIES.find(c => c.key === categoryKey);
    if (!cat) return;

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0a192f";
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`DVLA ON-SITE PHYSICAL INSPECTION`, 320, 190);
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px sans-serif";
      ctx.fillText(`${cat.label} — ${selectedApp?.registrationNumber}`, 320, 230);
      ctx.font = "12px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 320, 275);
      ctx.fillText(`Officer: ${officerName} (${officerRegion})`, 320, 300);
      ctx.fillText(`Status: Verified Physical Evidence`, 320, 325);
    }

    const testDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhotos(prev => ({
      ...prev,
      [categoryKey]: {
        categoryKey,
        categoryLabel: cat.label,
        dataUrl: testDataUrl,
        capturedAt: new Date().toISOString(),
      },
    }));

    stopCameraStream();
  };

  // ─── RETAKE PHOTO ───
  const handleRetakePhoto = (categoryKey: PhotoCategoryKey) => {
    setCapturedPhotos(prev => {
      const copy = { ...prev };
      delete copy[categoryKey];
      return copy;
    });
    handleStartCameraForCategory(categoryKey);
  };

  const capturedCategoryKeys = Object.keys(capturedPhotos);
  const outstandingCategories = INSPECTION_PHOTO_CATEGORIES.filter(cat => !capturedPhotos[cat.key]);
  const isAllPhotosCaptured = outstandingCategories.length === 0;

  // ─── SUBMIT INITIAL OR FOLLOW-UP INSPECTION ───
  const handleSubmitInspectionReport = async () => {
    setInspectionFormError(null);
    if (!selectedApp) return;

    if (!findings.trim()) {
      setInspectionFormError("Please record physical technical inspection findings and observations.");
      return;
    }

    if (!isAllPhotosCaptured) {
      const missingNames = outstandingCategories.map(c => c.label).join(", ");
      setInspectionFormError(`All 5 mandatory on-site vehicle photographs must be captured. Outstanding: ${missingNames}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const orderedPhotos = INSPECTION_PHOTO_CATEGORIES.map(
        c => capturedPhotos[c.key]?.dataUrl || ""
      );

      // If submitting a Follow-Up Inspection
      if (selectedFollowUp) {
        const res = await fetch("/api/inspections/follow-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: selectedApp.id,
            action: "COMPLETE",
            findings: findings.trim(),
            defects: defects.trim() || "No critical defects detected during follow-up.",
            outcome,
            photos: orderedPhotos,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setClaimFeedback({
            type: "success",
            title: "Follow-Up Inspection Submitted",
            message: data.message || `Follow-up inspection for ${selectedApp.registrationNumber} completed and recorded.`,
          });
          await loadFollowUps();
          if (onRefreshData) onRefreshData();
          handleCloseInspectionModal();
        } else {
          setInspectionFormError(data.error || "Failed to submit follow-up inspection. Please try again.");
        }
        return;
      }

      // Initial Inspection Submission
      const res = await fetch(`/api/applications/${selectedApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionStatus: "Completed",
          assignedOfficerId: currentUser?.id || "TO-409",
          assignedOfficerName: officerName,
          inspectionDate: today,
          inspectionFindings: findings.trim(),
          inspectionDefects: defects.trim() || "No critical defects detected.",
          inspectionOutcome: outcome,
          inspectionPhotos: orderedPhotos,
          applicationStatus: "Inspection Completed",
          actorName: officerName,
          actorRole: "Technical Officer",
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        if (onInspectionSubmitted) onInspectionSubmitted(updated);
        if (onRefreshData) onRefreshData();
        handleCloseInspectionModal();
        if (onSelectSection) onSelectSection("completed");
      } else {
        const err = await res.json();
        setInspectionFormError(err.error || "Failed to submit inspection. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setInspectionFormError("Network or server error while submitting inspection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── POST-SUBMISSION: UPLOAD INSPECTION REPORT ───
  const handleOpenReportModal = (app: LayoffApplication) => {
    setReportModalApp(app);
    setReportFile(null);
    setReportUploadError(null);
    setReportUploadSuccess(null);
  };

  const handleUploadReportFile = async () => {
    if (!reportModalApp || !reportFile) {
      setReportUploadError("Please select a valid inspection report document file.");
      return;
    }

    const validTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!validTypes.includes(reportFile.type) && !reportFile.name.endsWith(".pdf") && !reportFile.name.endsWith(".docx")) {
      setReportUploadError("Invalid document type. Allowed types: PDF, Word (DOC/DOCX), PNG, JPEG.");
      return;
    }

    if (reportFile.size > 15 * 1024 * 1024) {
      setReportUploadError("File size exceeds 15MB statutory limit.");
      return;
    }

    setIsUploadingReport(true);
    setReportUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", reportFile);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success || !uploadData.files?.[0]) {
        throw new Error(uploadData.error || "Failed to upload file to storage.");
      }

      const uploadedFile = uploadData.files[0];
      const now = new Date().toISOString();

      const patchRes = await fetch(`/api/applications/${reportModalApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionReportUrl: uploadedFile.fileUrl,
          inspectionReportFileName: uploadedFile.name,
          inspectionReportUploadedAt: now,
          inspectionReportUploadedBy: officerName,
          actorName: officerName,
          actorRole: "Technical Officer",
        }),
      });

      if (!patchRes.ok) {
        throw new Error("Failed to link inspection report to application record.");
      }

      const updatedApp = await patchRes.json();
      setReportUploadSuccess(`Inspection Report "${uploadedFile.name}" successfully uploaded and linked.`);
      if (onInspectionSubmitted) onInspectionSubmitted(updatedApp);
      if (onRefreshData) onRefreshData();

      setTimeout(() => {
        setReportModalApp(null);
        setReportFile(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setReportUploadError(err.message || "Error uploading inspection report.");
    } finally {
      setIsUploadingReport(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1720px] mx-auto px-3 sm:px-8 py-4 sm:py-6 animate-fade-in">
      <canvas ref={canvasRef} className="hidden" />

      {/* ─── REGIONAL JURISDICTION STRIP ─── */}
      <div className="bg-gradient-to-r from-[#006837] via-[#00552d] to-[#004222] text-white rounded-2xl p-4 sm:p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Technical Officer Case Management Console
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
            Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28: Physical Vehicle Layoff Inspections
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Badge className="bg-emerald-800/80 hover:bg-emerald-800 text-white border border-emerald-400/30 px-3 py-1 text-xs font-semibold gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-300" />
            Jurisdiction: {officerRegion}
          </Badge>
          <Badge className="bg-emerald-950/70 text-emerald-200 border border-emerald-500/30 px-3 py-1 text-xs font-semibold gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
            {stationLocation}
          </Badge>
          <Badge className="bg-white/10 text-white border border-white/20 px-3 py-1 text-xs font-semibold">
            Officer: {officerName}
          </Badge>
        </div>
      </div>

      {/* Claim Feedback Banner */}
      {claimFeedback && (
        <div
          className={cn(
            "p-4 rounded-xl border flex items-center justify-between animate-fade-in text-sm font-semibold",
            claimFeedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          )}
        >
          <div className="flex items-center gap-2">
            {claimFeedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            )}
            <span>{claimFeedback.message}</span>
          </div>
          <button
            onClick={() => setClaimFeedback(null)}
            className="text-xs uppercase tracking-wider underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── KPI SUMMARY TILES (Clickable to switch sections) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <button
          onClick={() => onSelectSection && onSelectSection("vehicle-lookup")}
          className={cn(
            "rounded-2xl border p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer",
            activeSection === "vehicle-lookup"
              ? "bg-teal-500/10 border-teal-500 ring-2 ring-teal-500/20"
              : "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 hover:border-teal-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              Vehicle Status Lookup
            </span>
            <div className="h-8 w-8 rounded-xl bg-teal-100 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Search className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {applications.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
            <span>Search Road Status &amp; Expiry</span>
            <ArrowRight className="h-3 w-3" />
          </p>
        </button>

        <button
          onClick={() => onSelectSection && onSelectSection("open-cases")}
          className={cn(
            "rounded-2xl border p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer",
            activeSection === "open-cases"
              ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 hover:border-amber-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Available Regional Pool
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {regionalPool.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
            <span>Approved by Admin, Ready to Claim</span>
            <ArrowRight className="h-3 w-3" />
          </p>
        </button>

        <button
          onClick={() => onSelectSection && onSelectSection("my-inspections")}
          className={cn(
            "rounded-2xl border p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer",
            activeSection === "my-inspections"
              ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20"
              : "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 hover:border-blue-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              My Active Inspections
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {myActiveInspections.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
            <span>Claimed cases in progress</span>
            <ArrowRight className="h-3 w-3" />
          </p>
        </button>

        <button
          onClick={() => onSelectSection && onSelectSection("completed")}
          className={cn(
            "rounded-2xl border p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer",
            activeSection === "completed"
              ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 hover:border-emerald-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Completed Inspections
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-[#006837] dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {myCompletedInspections.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
            <span>Evidence &amp; reports archived</span>
            <ArrowRight className="h-3 w-3" />
          </p>
        </button>

        <button
          onClick={() => onSelectSection && onSelectSection("follow-ups")}
          className={cn(
            "rounded-2xl border p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer",
            activeSection === "follow-ups"
              ? "bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/20"
              : "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 hover:border-purple-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Follow-Up &amp; Overdue
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-700 dark:text-purple-400">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {followUpRecords.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
            <span>Expired/Expiring in {officerRegion}</span>
            <ArrowRight className="h-3 w-3" />
          </p>
        </button>
      </div>

      {/* ─── FILTER / SEARCH STRIP (For Inspection Queues) ─── */}
      {activeSection !== "vehicle-lookup" && (
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="h-10 pl-10 text-xs sm:text-sm rounded-xl"
              placeholder="Search Reg No, VIN, Applicant..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-44 h-10 text-xs rounded-xl">
                <SelectValue placeholder="Inspection Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Methods</SelectItem>
                <SelectItem value="OFFICE">Office-Based Only</SelectItem>
                <SelectItem value="ON_SITE">On-Site Visit Only</SelectItem>
              </SelectContent>
            </Select>

            {onRefreshData && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshData}
                className="h-10 rounded-xl text-xs gap-1.5 shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ─── SECTION: VEHICLE STATUS & LAYOFF EXPIRY LOOKUP ─── */}
      {activeSection === "vehicle-lookup" && (
        <div className="space-y-6">
          {/* Search Header Box */}
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Search className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                  Vehicle Road Status &amp; Layoff Expiry Lookup
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Search any vehicle by its <strong>Layoff Reference Number</strong> (e.g. <span className="font-mono">LAY-2026-GT492022</span>) or <strong>Vehicle Registration Number</strong> (e.g. <span className="font-mono">GT-4920-22</span>) to verify whether it is <strong>Off Road</strong> or <strong>On Road</strong> and when its layoff period expires.
                </p>
              </div>
              {vehicleLookupQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVehicleLookupQuery("")}
                  className="rounded-xl text-xs gap-1.5 self-start sm:self-auto"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear Search
                </Button>
              )}
            </div>

            {/* Search Input Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={vehicleLookupQuery}
                  onChange={(e) => setVehicleLookupQuery(e.target.value)}
                  placeholder="Enter Layoff Reference Number (e.g. LAY-2026-GT492022) or Vehicle Number (e.g. GT-4920-22)..."
                  className="h-12 pl-11 pr-4 text-sm font-medium rounded-xl border-slate-300 dark:border-zinc-700"
                />
              </div>
            </div>

            {/* Quick Lookup Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Lookup:
              </span>
              {applications.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setVehicleLookupQuery(item.registrationNumber)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer",
                    vehicleLookupQuery.toLowerCase() === item.registrationNumber.toLowerCase() ||
                      vehicleLookupQuery.toLowerCase() === item.id.toLowerCase()
                      ? "bg-[#006837] text-white border-[#006837]"
                      : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-[#006837]"
                  )}
                >
                  {item.registrationNumber} ({item.id})
                </button>
              ))}
            </div>
          </div>

          {/* Search Results Grid */}
          {(() => {
            const q = vehicleLookupQuery.trim().toLowerCase();
            const matchedVehicles = applications.filter((app) => {
              if (!q) return true;
              const cleanQ = q.replace(/[\s-]/g, "");
              const cleanReg = (app.registrationNumber || "").toLowerCase().replace(/[\s-]/g, "");
              const cleanId = (app.id || "").toLowerCase().replace(/[\s-]/g, "");
              return (
                app.id.toLowerCase().includes(q) ||
                app.registrationNumber.toLowerCase().includes(q) ||
                cleanReg.includes(cleanQ) ||
                cleanId.includes(cleanQ) ||
                (app.applicantName && app.applicantName.toLowerCase().includes(q)) ||
                (app.ownerName && app.ownerName.toLowerCase().includes(q))
              );
            });

            if (matchedVehicles.length === 0) {
              return (
                <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] space-y-2">
                  <Car className="h-10 w-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                    No Vehicle Record Found for &ldquo;{vehicleLookupQuery}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500">
                    Check the Layoff Reference Number (e.g. LAY-2026-8810) or Vehicle Registration Number (e.g. GT-4920-22) and try again.
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {matchedVehicles.map((app) => {
                  const isOffRoad =
                    app.vehicleRoadStatus === "Off Road" ||
                    app.status === "Active Layoff" ||
                    (app.adminApprovalStatus === "Approved" && app.paymentStatus === "Paid");
                  const roadStatusLabel = isOffRoad ? "OFF ROAD" : "ON ROAD";

                  // Calculate days until layoff expiry
                  const expiryDateStr = app.layoffExpiryDate || "";
                  const startDateStr = app.layoffStartDate || app.submittedAt?.slice(0, 10) || "—";
                  let expiryCountdownText = "Expiry date pending approval";
                  let isExpired = false;
                  let isExpiringSoon = false;

                  if (expiryDateStr) {
                    const todayMs = new Date().setHours(0, 0, 0, 0);
                    const expiryMs = new Date(expiryDateStr).setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((expiryMs - todayMs) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) {
                      isExpired = true;
                      expiryCountdownText = `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`;
                    } else if (diffDays === 0) {
                      isExpiringSoon = true;
                      expiryCountdownText = "Expires Today";
                    } else if (diffDays <= 14) {
                      isExpiringSoon = true;
                      expiryCountdownText = `Expiring in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
                    } else {
                      expiryCountdownText = `${diffDays} days remaining`;
                    }
                  }

                  const canViewCert = app.adminApprovalStatus === "Approved" && app.paymentStatus === "Paid";

                  return (
                    <Card
                      key={app.id}
                      className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all"
                    >
                      {/* Top Status Banner: OFF ROAD vs ON ROAD */}
                      <div
                        className={cn(
                          "px-5 py-3 flex items-center justify-between border-b",
                          isOffRoad
                            ? "bg-emerald-950 text-white border-emerald-800"
                            : "bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              isOffRoad ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
                            )}
                          />
                          <span className="text-xs font-black uppercase tracking-wider">
                            Vehicle Road Status: {roadStatusLabel}
                          </span>
                        </div>
                        <Badge
                          variant={isOffRoad ? "success" : "warning"}
                          className="text-[10px] font-black uppercase"
                        >
                          {isOffRoad ? "Grounded (Off Road)" : "On Road"}
                        </Badge>
                      </div>

                      <CardContent className="p-5 space-y-4">
                        {/* Vehicle Number Plate & Layoff Ref */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="inline-flex items-center rounded-lg border-2 border-slate-900 bg-white px-3 py-1 shadow-2xs">
                              <span className="text-[9px] font-black text-slate-700 border-r border-slate-300 pr-2 mr-2">
                                GH
                              </span>
                              <span className="font-mono text-lg font-black tracking-widest text-slate-900">
                                {app.registrationNumber}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 pt-1">
                              {app.make} {app.model} {app.yearOfMake ? `(${app.yearOfMake})` : ""} &bull;{" "}
                              <span className="text-slate-500">{app.colour || "Standard"}</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                              Layoff Reference No.
                            </span>
                            <span className="font-mono text-sm font-black text-[#006837] dark:text-emerald-400">
                              {app.id}
                            </span>
                          </div>
                        </div>

                        {/* Highlighted Layoff Expiry & Period Box */}
                        <div className="rounded-xl border-2 border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-[#006837] dark:text-emerald-400" />
                              Layoff Validity &amp; Expiry Schedule
                            </span>
                            <Badge
                              variant={isExpired ? "danger" : isExpiringSoon ? "warning" : "info"}
                              className="text-[10px] font-bold"
                            >
                              {expiryCountdownText}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Layoff Start Date</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                                {startDateStr}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-rose-500 font-bold block">Layoff Expiry Date</span>
                              <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                                {expiryDateStr || "Pending"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Duration</span>
                              <span className="font-bold text-slate-900 dark:text-zinc-100">
                                {app.layoffPeriodMonths || 3} Months
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Owner & Storage Metadata */}
                        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Vehicle Owner / Applicant</span>
                            <span className="font-bold text-slate-900 dark:text-zinc-100">
                              {app.ownerName || app.applicantName}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Declared Storage Location</span>
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">
                              {app.storageFacilityName || app.storageRegion || "Greater Accra"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Application Status</span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200">
                              {app.adminApprovalStatus || "Pending"} &bull; {app.paymentStatus || "Unpaid"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Chassis / VIN</span>
                            <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                              {app.chassisNumber}
                            </span>
                          </div>
                        </div>

                        {/* Action Button to View Certificate & QR Code */}
                        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">
                            {canViewCert
                              ? "Official Layoff Certificate & QR Code issued"
                              : "Certificate pending approval/payment"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={canViewCert ? "default" : "outline"}
                            onClick={() => setCertificateModalApp(app)}
                            className={cn(
                              "rounded-xl text-xs font-bold gap-1.5",
                              canViewCert ? "bg-[#006837] hover:bg-[#00552d] text-white" : ""
                            )}
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            {canViewCert ? "View Layoff Certificate & QR" : "Certificate Status"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── SECTION 1: WORKSPACE OVERVIEW ─── */}
      {activeSection === "workspace" && (
        <div className="space-y-6">
          {/* Quick Notice Card */}
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                Statutory Physical Inspection Workflow
              </h3>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 max-w-3xl">
                Under L.I. 2519 Regulation 28, administrative approval triggers case eligibility in the regional pool. Technical Officers stationed in <strong>{officerRegion}</strong> claim cases atomically. In-app camera captures 5 mandatory views with tamper-resistant watermarks.
              </p>
            </div>
            <Button
              onClick={() => onSelectSection && onSelectSection("open-cases")}
              className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 shrink-0"
            >
              <Wrench className="h-4 w-4" />
              View Available Cases ({regionalPool.length})
            </Button>
          </div>

          {/* Quick Split View: Open Cases & My In-Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Available Pool Preview */}
            <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                    Available Regional Pool ({regionalPool.length})
                  </h3>
                  <p className="text-xs text-slate-500">Unclaimed cases in {officerRegion}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectSection && onSelectSection("open-cases")}
                  className="text-xs text-[#006837] dark:text-emerald-400 font-bold"
                >
                  View All &rarr;
                </Button>
              </div>

              {regionalPool.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No unclaimed cases in {officerRegion} currently.
                </div>
              ) : (
                <div className="space-y-3">
                  {regionalPool.slice(0, 3).map(app => (
                    <div
                      key={app.id}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">{app.registrationNumber}</span>
                          <Badge variant="gold" className="text-[10px]">{app.inspectionMethod}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{app.make} {app.model} &bull; {app.applicantName}</p>
                      </div>
                      <Button
                        size="sm"
                        disabled={claimingId === app.id}
                        onClick={() => handleClaimInspection(app.id)}
                        className="bg-[#006837] hover:bg-[#00552d] text-white text-xs font-bold rounded-lg shrink-0 gap-1.5"
                      >
                        {claimingId === app.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Claim
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: My Active Inspections Preview */}
            <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
                    My Active Inspections ({myActiveInspections.length})
                  </h3>
                  <p className="text-xs text-slate-500">Cases currently claimed by you</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectSection && onSelectSection("my-inspections")}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold"
                >
                  View All &rarr;
                </Button>
              </div>

              {myActiveInspections.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  You have not claimed any active inspections yet. Claim from the regional pool.
                </div>
              ) : (
                <div className="space-y-3">
                  {myActiveInspections.slice(0, 3).map(app => (
                    <div
                      key={app.id}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">{app.registrationNumber}</span>
                          <Badge variant="info" className="text-[10px]">In Progress</Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{app.make} {app.model} &bull; {app.storageRegion || "Regional"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unclaimingId === app.id}
                          onClick={() => handlePromptUnclaim(app)}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs font-bold rounded-lg gap-1"
                        >
                          {unclaimingId === app.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Unclaim
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenInspection(app)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg gap-1.5"
                        >
                          <Camera className="h-3 w-3" />
                          Inspect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 2: OPEN REGIONAL CASES POOL ─── */}
      {activeSection === "open-cases" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-600" />
                Available Regional Case Pool — {officerRegion}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Approved applications requiring physical inspection within your operational jurisdiction. Click &quot;Claim Inspection&quot; to take ownership.
              </p>
            </div>
            <Badge variant="gold" className="text-xs font-bold px-3 py-1">
              {filterList(regionalPool).length} Cases Available
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filterList(regionalPool).length === 0 ? (
              <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">All Regional Cases Claimed</p>
                <p className="text-xs text-slate-500 mt-1">
                  There are no unassigned approved applications currently waiting in {officerRegion}.
                </p>
              </div>
            ) : (
              filterList(regionalPool).map(app => {
                const isOnSite = app.inspectionMethod === "ON_SITE";
                const isClaiming = claimingId === app.id;

                return (
                  <Card key={app.id} className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                    <CardContent className="p-5 space-y-4">
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{app.id}</span>
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                            {app.registrationNumber}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                            {app.make} {app.model} ({app.yearOfMake || "2022"})
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge variant={isOnSite ? "gold" : "info"} className="text-[10px]">
                            {isOnSite ? "On-Site Visit" : "Office Station"}
                          </Badge>
                          <Badge variant="warning" className="text-[10px]">
                            Awaiting Officer
                          </Badge>
                        </div>
                      </div>

                      {/* Details Box */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/80 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Chassis / VIN:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">{app.chassisNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Applicant:</span>
                          <span className="font-semibold text-slate-900 dark:text-zinc-100">{app.applicantName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Applicant Phone:</span>
                          <span className="font-medium text-slate-700 dark:text-zinc-300">{app.applicantPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Layoff Period:</span>
                          <span className="font-semibold">{app.layoffPeriodMonths} Months</span>
                        </div>

                        {isOnSite ? (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800 space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-bold">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{app.inspectionSiteArea || "Storage Premises"}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate">{app.inspectionSiteAddress}</p>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span>{app.inspectionOfficeLocation || stationLocation}</span>
                          </div>
                        )}
                      </div>

                      {/* Claim Action */}
                      <Button
                        disabled={isClaiming}
                        onClick={() => handleClaimInspection(app.id)}
                        className="w-full bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 shadow-xs"
                      >
                        {isClaiming ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Locking Case in Database...
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Claim Inspection Case
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── SECTION 3: MY ACTIVE INSPECTIONS (WITH ACTIVE / FOLLOW-UP SWITCHER) ─── */}
      {activeSection === "my-inspections" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                {activeInspectionTab === "ACTIVE"
                  ? `My Active Inspections (${filterList(myActiveInspections).length})`
                  : `My Claimed Follow-Up Inspections (${filterFollowUps(myActiveFollowUps).length})`}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {activeInspectionTab === "ACTIVE"
                  ? "Initial inspection cases claimed by you. Complete within 4 days (SMS reminder sent at 24h remaining) or case releases back into pool."
                  : "Follow-up inspection cases claimed by you. Review the previous officer's first inspection findings and submit your follow-up inspection report & photos."}
              </p>
            </div>

            {/* Switcher: Active Inspections (Default) vs Follow-Up Inspections */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveInspectionTab("ACTIVE")}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer",
                  activeInspectionTab === "ACTIVE"
                    ? "bg-[#006837] text-white shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Active Inspections</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                  activeInspectionTab === "ACTIVE"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                )}>
                  {myActiveInspections.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInspectionTab("FOLLOW_UP")}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer",
                  activeInspectionTab === "FOLLOW_UP"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                )}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                <span>Follow-Up Inspections</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                  activeInspectionTab === "FOLLOW_UP"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                )}>
                  {myActiveFollowUps.length}
                </span>
              </button>
            </div>
          </div>

          {activeInspectionTab === "ACTIVE" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filterList(myActiveInspections).length === 0 ? (
                <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
                  <Clock className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">No Active In-Progress Cases</p>
                  <p className="text-xs text-slate-500 mt-1">Claim a case from the regional pool to begin physical inspection.</p>
                </div>
              ) : (
                filterList(myActiveInspections).map(app => {
                  const isOnSite = app.inspectionMethod === "ON_SITE";
                  const slaInfo = getClaimSlaRemaining(app.claimedAt);
                  const isUrgent24h = slaInfo.isWithin24Hours;

                  return (
                    <Card key={app.id} className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                      <CardContent className="p-5 space-y-4">
                        {/* Top Bar */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{app.id}</span>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                              {app.registrationNumber}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                              {app.make} {app.model} ({app.yearOfMake || "2022"})
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge variant={isOnSite ? "gold" : "info"} className="text-[10px]">
                              {isOnSite ? "On-Site Visit" : "Office Station"}
                            </Badge>
                            <Badge variant={isUrgent24h ? "danger" : "warning"} className="text-[10px] gap-1">
                              <Clock className="h-3 w-3" />
                              {slaInfo.label}
                            </Badge>
                          </div>
                        </div>

                        {/* 4-Day Auto-Release & 24h SMS Reminder Notice */}
                        <div className={cn(
                          "px-3 py-2 rounded-xl border text-[11px] font-semibold flex flex-col gap-0.5",
                          isUrgent24h
                            ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300"
                            : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300"
                        )}>
                          <div className="flex items-center justify-between">
                            <span>4-Day Completion Window:</span>
                            <span>{isUrgent24h ? "24h SMS Reminder Sent" : "Auto-releases after 4 days"}</span>
                          </div>
                          <span className="text-[10px] opacity-85">
                            {isUrgent24h
                              ? `SMS Dispatched: Officer ${officerName.replace(/\s*\(.*?\)\s*/g, "").trim()}, complete this case ${app.id} (${app.registrationNumber}) in 24 hours else it will be released into the pool.`
                              : "Reminder SMS automatically sent to Technical Officer when 24 hours remain."}
                          </span>
                        </div>

                        {/* Details Box */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/80 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Chassis / VIN:</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">{app.chassisNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Applicant:</span>
                            <span className="font-semibold text-slate-900 dark:text-zinc-100">{app.applicantName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Applicant Phone:</span>
                            <span className="font-medium">{app.applicantPhone}</span>
                          </div>

                          {isOnSite ? (
                            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800 space-y-1">
                              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-bold">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{app.inspectionSiteArea || "Location"}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate">{app.inspectionSiteAddress}</p>
                              <p className="text-[11px] text-slate-500">Contact: {app.inspectionContactPerson || app.applicantName} ({app.inspectionContactPhone || app.applicantPhone})</p>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              <span>{app.inspectionOfficeLocation || stationLocation}</span>
                            </div>
                          )}
                        </div>

                        {/* Launch Console & Unclaim Actions */}
                        <div className="space-y-2">
                          <Button
                            onClick={() => handleOpenInspection(app)}
                            className="w-full bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 shadow-xs"
                          >
                            <Camera className="h-4 w-4" />
                            Launch Camera &amp; Inspection Console
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={unclaimingId === app.id}
                            onClick={() => handlePromptUnclaim(app)}
                            className="w-full rounded-xl text-xs font-bold gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800/70 dark:text-rose-400 dark:hover:bg-rose-950/30"
                          >
                            {unclaimingId === app.id ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                Releasing Case...
                              </>
                            ) : (
                              <>
                                <RotateCcw className="h-3.5 w-3.5" />
                                Unclaim Case (Return to Regional Pool)
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filterFollowUps(myActiveFollowUps).length === 0 ? (
                <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
                  <CalendarCheck className="h-10 w-10 text-purple-300 dark:text-purple-700 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">No Claimed Follow-Up Inspections</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Go to the &quot;Follow-Up &amp; Overdue&quot; tab to claim a follow-up case and inspect it.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectSection && onSelectSection("follow-ups")}
                    className="mt-4 rounded-xl text-xs font-bold gap-1.5 border-purple-300 text-purple-700 dark:text-purple-300"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Browse Follow-Up Pool
                  </Button>
                </div>
              ) : (
                filterFollowUps(myActiveFollowUps).map(item => (
                  <Card key={item.applicationId} className="overflow-hidden border-purple-200 dark:border-purple-900/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                    <CardContent className="p-5 space-y-4">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{item.applicationId}</span>
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                            {item.registrationNumber}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                            {item.make} {item.model} ({item.yearOfMake || "2022"})
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[10px]">
                            Follow-Up In Progress
                          </Badge>
                          <Badge variant={item.isExpired ? "danger" : "warning"} className="text-[10px]">
                            Exp: {item.layoffExpiryDate}
                          </Badge>
                        </div>
                      </div>

                      {/* Previous Technical Officer's First Inspection Submission */}
                      <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-amber-200/70 dark:border-amber-800/50 pb-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Previous Officer&apos;s First Inspection
                          </span>
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            {item.firstInspectionDate}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Inspected By:</span>
                          <span className="font-bold text-slate-900 dark:text-zinc-100">{item.previousOfficerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Initial Outcome:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{item.firstInspectionOutcome}</span>
                        </div>
                        <div className="pt-1">
                          <p className="text-[10px] font-bold uppercase text-slate-500">Detailed Description (1st Inspection):</p>
                          <p className="text-xs text-slate-800 dark:text-zinc-200 mt-0.5 leading-relaxed bg-white/80 dark:bg-zinc-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-zinc-800">
                            {item.firstInspectionFindings}
                          </p>
                        </div>
                        <div className="pt-0.5">
                          <p className="text-[10px] font-bold uppercase text-slate-500">Defects Recorded:</p>
                          <p className="text-[11px] text-slate-600 dark:text-zinc-400">{item.firstInspectionDefects}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviousInspectionModal(item)}
                          className="w-full h-8 rounded-lg text-[11px] font-bold gap-1.5 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 hover:bg-amber-100/60"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Previous Officer&apos;s Full Dossier &amp; Photos ({item.firstInspectionPhotos?.length || 0})
                        </Button>
                      </div>

                      {/* Launch Follow-Up Camera & Findings Console */}
                      <div className="space-y-2">
                        <Button
                          onClick={() => handleOpenFollowUpInspection(item)}
                          className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold gap-2 shadow-xs"
                        >
                          <Camera className="h-4 w-4" />
                          Launch Follow-Up Camera &amp; Upload Findings
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={schedulingId === item.applicationId}
                          onClick={() => handleUnclaimFollowUp(item.applicationId)}
                          className="w-full rounded-xl text-xs font-bold gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800/70 dark:text-rose-400"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Unclaim Follow-Up Case (Return to Pool)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── SECTION 4: COMPLETED INSPECTIONS ─── */}
      {activeSection === "completed" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Completed Physical Inspections ({filterList(myCompletedInspections).length})
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Records of finalized physical examinations with camera evidence and post-submission technical reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filterList(myCompletedInspections).length === 0 ? (
              <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
                <FileCheck className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">No Completed Inspections Recorded</p>
              </div>
            ) : (
              filterList(myCompletedInspections).map(app => {
                const hasReport = Boolean(app.inspectionReportUrl);

                return (
                  <Card key={app.id} className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
                    <CardContent className="p-5 space-y-4">
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{app.id}</span>
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                            {app.registrationNumber}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                            {app.make} {app.model}
                          </p>
                        </div>
                        <Badge variant="success" className="text-[10px]">
                          Completed
                        </Badge>
                      </div>

                      {/* Findings summary */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/80 space-y-2 text-xs">
                        <div>
                          <p className="text-slate-500 text-[11px]">Inspection Date:</p>
                          <p className="font-semibold text-slate-900 dark:text-zinc-100">{app.inspectionDate || "Completed"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[11px]">Outcome:</p>
                          <p className="font-bold text-emerald-700 dark:text-emerald-400">{app.inspectionOutcome || "Passed"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[11px]">Findings:</p>
                          <p className="text-slate-700 dark:text-zinc-300 line-clamp-2">{app.inspectionFindings || "Vehicle inspected and verified."}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-2 pt-1">
                        <Button
                          variant="outline"
                          onClick={() => handleOpenInspection(app)}
                          className="w-full rounded-xl text-xs font-bold gap-2"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Review Inspection &amp; Photos
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleOpenReportModal(app)}
                          className={cn(
                            "w-full rounded-xl text-xs font-bold gap-2 border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
                            hasReport ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                          )}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {hasReport ? "Replace Technical Report" : "Upload Inspection Report (PDF)"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── SECTION 5: FOLLOW-UP & OVERDUE INSPECTIONS ─── */}
      {activeSection === "follow-ups" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-purple-600" />
                Follow-Up Inspection Cases — {officerRegion} ({filterFollowUps(followUpRecords).length})
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Review what the previous Technical Officer submitted on the first inspection, claim the follow-up case, and upload your follow-up findings &amp; 5 camera photos.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFollowUps}
              disabled={followUpLoading}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", followUpLoading && "animate-spin")} />
              Refresh Follow-Ups
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filterFollowUps(followUpRecords).length === 0 ? (
              <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212]">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">No Follow-Up Cases in {officerRegion}</p>
                <p className="text-xs text-slate-500 mt-1">Once an initial vehicle inspection is completed, it appears here for follow-up compliance tracking.</p>
              </div>
            ) : (
              filterFollowUps(followUpRecords).map(item => {
                const isProcessing = schedulingId === item.applicationId;
                const isClaimed = item.followUpStatus === "In Progress";
                const isCompleted = item.followUpStatus === "Completed";

                return (
                  <Card key={item.applicationId} className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                    <CardContent className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400">{item.applicationId}</span>
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100">{item.registrationNumber}</h3>
                          <p className="text-xs text-slate-600 dark:text-zinc-400">{item.make} {item.model} ({item.yearOfMake || "2022"})</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant={isCompleted ? "success" : isClaimed ? "info" : item.isExpired ? "danger" : "warning"}
                            className="text-[10px]"
                          >
                            {isCompleted
                              ? "Follow-Up Completed"
                              : isClaimed
                              ? "Claimed (In Progress)"
                              : item.isExpired
                              ? "Layoff Expired"
                              : "Ready for Follow-Up"}
                          </Badge>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Exp: {item.layoffExpiryDate}
                          </span>
                        </div>
                      </div>

                      {/* Vehicle & Owner Info */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/80 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Road Status:</span>
                          <Badge variant="outline" className="text-[10px]">{item.vehicleRoadStatus}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Owner Contact:</span>
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">{item.applicantName} ({item.applicantPhone})</span>
                        </div>
                        <div className="pt-1 text-[11px] text-slate-500">
                          Storage Site: {item.inspectionSiteAddress || item.storageRegion}
                        </div>
                      </div>

                      {/* PREVIOUS TECHNICAL OFFICER'S FIRST INSPECTION SUBMISSION */}
                      <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-amber-200/70 dark:border-amber-800/50 pb-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            1st Inspection (Previous Officer)
                          </span>
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            {item.firstInspectionDate}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Previous Officer:</span>
                          <span className="font-bold text-slate-900 dark:text-zinc-100">{item.previousOfficerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">1st Outcome:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{item.firstInspectionOutcome}</span>
                        </div>
                        <div className="pt-1">
                          <p className="text-[10px] font-bold uppercase text-slate-500">
                            Detailed Description of First Inspection:
                          </p>
                          <p className="text-xs text-slate-800 dark:text-zinc-200 mt-0.5 leading-relaxed bg-white/80 dark:bg-zinc-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-zinc-800">
                            {item.firstInspectionFindings}
                          </p>
                        </div>
                        <div className="pt-0.5">
                          <p className="text-[10px] font-bold uppercase text-slate-500">Defects Recorded:</p>
                          <p className="text-[11px] text-slate-600 dark:text-zinc-400">{item.firstInspectionDefects}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviousInspectionModal(item)}
                          className="w-full h-8 rounded-lg text-[11px] font-bold gap-1.5 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 hover:bg-amber-100/60"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Previous Officer&apos;s Full Dossier &amp; Photos ({item.firstInspectionPhotos?.length || 0})
                        </Button>
                      </div>

                      {/* Follow-Up Completed Summary (if completed) */}
                      {isCompleted && (
                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
                              Follow-Up Findings Submitted
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {item.followUpConductedAt}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 dark:text-zinc-200">{item.followUpFindings}</p>
                          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            By: {item.followUpOfficerName} — {item.followUpOutcome}
                          </p>
                        </div>
                      )}

                      {/* Claim / Open / Review Action Buttons */}
                      {isCompleted ? (
                        <Button
                          variant="outline"
                          onClick={() => handleOpenFollowUpInspection(item)}
                          className="w-full rounded-xl text-xs font-bold gap-2 border-emerald-300 text-emerald-800 dark:text-emerald-300"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Review Follow-Up Submission &amp; Photos
                        </Button>
                      ) : isClaimed ? (
                        <div className="space-y-2">
                          <Button
                            onClick={() => handleOpenFollowUpInspection(item)}
                            className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold gap-2"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Launch Follow-Up Camera &amp; Upload Findings
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => handleUnclaimFollowUp(item.applicationId)}
                            className="w-full rounded-xl text-xs font-bold gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Release Back to Follow-Up Pool
                          </Button>
                        </div>
                      ) : (
                        <Button
                          disabled={isProcessing}
                          onClick={() => handleClaimFollowUp(item.applicationId)}
                          className="w-full bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 shadow-xs"
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Claim Follow-Up Inspection Case
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: PHYSICAL INSPECTION CAMERA & FINDINGS (INITIAL OR FOLLOW-UP) ─── */}
      {selectedApp && (
        <Dialog
          isOpen={isInspectionModalOpen}
          onClose={handleCloseInspectionModal}
          title={
            selectedFollowUp
              ? `Follow-Up Vehicle Inspection: ${selectedApp.registrationNumber} (${selectedApp.id})`
              : `Physical Vehicle Inspection: ${selectedApp.registrationNumber} (${selectedApp.id})`
          }
          description={
            selectedFollowUp
              ? "Review the previous Technical Officer's first inspection findings below, capture 5 follow-up vehicle photographs, and upload your follow-up observations."
              : "Capture 5 mandatory vehicle photographs using device camera at inspection premises and record technical observations."
          }
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 text-slate-800 dark:text-zinc-200">
            {/* Vehicle Summary Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Make &amp; Model</p>
                <p className="font-bold text-slate-900 dark:text-zinc-100">{selectedApp.make} {selectedApp.model}</p>
              </div>
              <div>
                <p className="text-slate-500">Chassis / VIN</p>
                <p className="font-mono font-bold text-slate-900 dark:text-zinc-100">{selectedApp.chassisNumber}</p>
              </div>
              <div>
                <p className="text-slate-500">Inspection Type</p>
                <p className="font-bold text-[#006837] dark:text-emerald-400">
                  {selectedFollowUp ? "Follow-Up Re-Inspection" : selectedApp.inspectionMethod === "ON_SITE" ? "On-Site Premises Visit" : "Office Testing Center"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Storage Region</p>
                <p className="font-bold">{selectedApp.storageRegion || officerRegion}</p>
              </div>
            </div>

            {/* IF FOLLOW-UP: SHOW PREVIOUS TECHNICAL OFFICER'S FIRST INSPECTION SUBMISSION */}
            {selectedFollowUp && (
              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 dark:border-amber-800/60 pb-2">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Previous Technical Officer&apos;s First Inspection Submission
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Inspected by <strong>{selectedFollowUp.previousOfficerName}</strong> on <strong>{selectedFollowUp.firstInspectionDate}</strong>
                    </p>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    1st Outcome: {selectedFollowUp.firstInspectionOutcome}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/70 dark:border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Detailed Description of First Inspection:
                    </p>
                    <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                      {selectedFollowUp.firstInspectionFindings}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/70 dark:border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Defects &amp; Mechanical Observations (1st Inspection):
                    </p>
                    <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                      {selectedFollowUp.firstInspectionDefects}
                    </p>
                  </div>
                </div>

                {selectedFollowUp.firstInspectionPhotos?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      Previous Officer&apos;s 5 First Inspection Photographs:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {selectedFollowUp.firstInspectionPhotos.slice(0, 5).map((photoUrl: string, idx: number) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-amber-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoUrl} alt={`1st Inspection View ${idx + 1}`} className="w-full h-16 object-cover" />
                          <p className="text-[9px] text-center py-0.5 font-semibold text-slate-600 dark:text-zinc-400 truncate px-1">
                            {INSPECTION_PHOTO_CATEGORIES[idx]?.label || `View ${idx + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5 Mandatory Views Status */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-emerald-600" />
                    Mandatory On-Site Camera Vehicle Photographs
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Photographs must be captured on-site with device camera. File upload is restricted to prevent tampering.
                  </p>
                </div>
                <Badge variant={isAllPhotosCaptured ? "success" : "warning"} className="text-xs gap-1.5 self-start sm:self-auto">
                  {isAllPhotosCaptured ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      All 5 Views Captured
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {capturedCategoryKeys.length} / 5 Captured ({outstandingCategories.length} Outstanding)
                    </>
                  )}
                </Badge>
              </div>

              {/* LIVE CAMERA VIEWFINDER */}
              {activeCameraCategory && (
                <div className="p-4 rounded-2xl bg-black text-white space-y-4 border border-zinc-700 animate-fade-in shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono uppercase text-emerald-400 tracking-wider">
                        Active Camera: {INSPECTION_PHOTO_CATEGORIES.find(c => c.key === activeCameraCategory)?.label}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Position the vehicle and click &quot;Snap Photo&quot; to watermark and record evidence.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={stopCameraStream}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {cameraError ? (
                    <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs space-y-3">
                      <p className="font-semibold flex items-center gap-2">
                        <CameraOff className="h-4 w-4 text-rose-400" />
                        {cameraError}
                      </p>
                      <p className="text-[11px] text-rose-300">
                        For desktop simulation, use the test capture button below to verify inspection workflow.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSimulateCaptureForCategory(activeCameraCategory)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs"
                      >
                        Simulate On-Site Capture for {INSPECTION_PHOTO_CATEGORIES.find(c => c.key === activeCameraCategory)?.label}
                      </Button>
                    </div>
                  ) : (
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {isStartingCamera && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-2 text-xs text-white">
                          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                          Initializing camera hardware...
                        </div>
                      )}
                    </div>
                  )}

                  {!cameraError && isCameraActive && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={handleCaptureSnapshot}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 py-2.5 text-xs font-bold gap-2 shadow-lg"
                      >
                        <Camera className="h-4 w-4" />
                        Snap Photo Now
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSimulateCaptureForCategory(activeCameraCategory)}
                        className="text-xs text-zinc-300 border-zinc-700"
                      >
                        Simulate Capture
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 5 Photo Grid Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {INSPECTION_PHOTO_CATEGORIES.map(cat => {
                  const photo = capturedPhotos[cat.key];

                  return (
                    <div
                      key={cat.key}
                      className={cn(
                        "rounded-xl border p-2.5 flex flex-col justify-between text-left transition-all",
                        photo
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                          : "bg-slate-50 dark:bg-zinc-900 border-dashed border-slate-300 dark:border-zinc-700"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 truncate">{cat.label}</span>
                          {photo && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
                        </div>

                        {photo ? (
                          <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-800 my-1 group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.dataUrl} alt={cat.label} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                onClick={() => handleRetakePhoto(cat.key)}
                                className="h-6 text-[10px] px-2 rounded"
                              >
                                Retake
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video rounded-lg bg-slate-200/50 dark:bg-zinc-800/50 flex flex-col items-center justify-center my-1 text-slate-400">
                            <Camera className="h-5 w-5 mb-0.5" />
                            <span className="text-[9px]">Required</span>
                          </div>
                        )}
                      </div>

                      {!photo && (
                        <div className="space-y-1 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleStartCameraForCategory(cat.key)}
                            className="w-full h-7 text-[10px] font-bold rounded-md bg-[#006837] text-white hover:bg-[#00552d]"
                          >
                            Open Camera
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleSimulateCaptureForCategory(cat.key)}
                            className="w-full text-[9px] text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300 underline"
                          >
                            Simulate
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Technical Observations & Defects */}
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                Technical Examination Findings &amp; Observations
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Physical Technical Findings <span className="text-rose-500">*</span>
                </label>
                <textarea
                  className="w-full h-24 p-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] focus:ring-2 focus:ring-[#006837] outline-none"
                  placeholder="Record vehicle physical condition, odometer reading, tyre condition, battery state, secure storage enclosure observations, etc..."
                  value={findings}
                  onChange={e => setFindings(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Critical Defects or Mechanical Deficiencies Observed
                </label>
                <textarea
                  className="w-full h-20 p-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] focus:ring-2 focus:ring-[#006837] outline-none"
                  placeholder="List any safety hazards, fluid leakages, damaged body panels, engine seizure, or state 'No critical defects detected'."
                  value={defects}
                  onChange={e => setDefects(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Statutory Layoff Recommendation Outcome <span className="text-rose-500">*</span>
                </label>
                <Select value={outcome} onValueChange={(v: any) => setOutcome(v)}>
                  <SelectTrigger className="w-full text-xs rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inspection completed successfully">
                      Pass — Layoff Approved (Vehicle physically grounded &amp; compliant)
                    </SelectItem>
                    <SelectItem value="Inspection completed with issues">
                      Conditional Pass — Layoff Approved with minor cautions
                    </SelectItem>
                    <SelectItem value="Further inspection or information required">
                      Hold — Vehicle discrepancy or re-inspection required
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {inspectionFormError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{inspectionFormError}</span>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                {selectedApp.inspectionStatus !== "Completed" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePromptUnclaim(selectedApp)}
                    disabled={isSubmitting || unclaimingId === selectedApp.id}
                    className="rounded-xl text-xs font-bold gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    {unclaimingId === selectedApp.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Unclaim Case
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseInspectionModal}
                  disabled={isSubmitting}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitInspectionReport}
                  disabled={isSubmitting}
                  className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 px-5 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Submitting Inspection...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Finalize Physical Inspection
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── MODAL 2: POST-SUBMISSION VEHICLE INSPECTION REPORT UPLOAD ─── */}
      {reportModalApp && (
        <Dialog
          isOpen={Boolean(reportModalApp)}
          onClose={() => setReportModalApp(null)}
          title={`Upload Vehicle Inspection Report: ${reportModalApp.registrationNumber}`}
          description="Attach official certified DVLA Inspection Report document (PDF/Word) to complete the statutory audit dossier."
          maxWidth="max-w-xl"
        >
          <div className="space-y-5 text-slate-800 dark:text-zinc-200">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs space-y-1">
              <p><strong className="text-slate-900 dark:text-zinc-100">Application Reference:</strong> {reportModalApp.id}</p>
              <p><strong className="text-slate-900 dark:text-zinc-100">Vehicle:</strong> {reportModalApp.registrationNumber} ({reportModalApp.make} {reportModalApp.model})</p>
              <p><strong className="text-slate-900 dark:text-zinc-100">Technical Officer:</strong> {officerName}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Select Official Inspection Report Document
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={e => setReportFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-300 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Authorized formats: PDF, DOCX, PNG, JPEG. Maximum file size: 15MB.
              </p>
            </div>

            {reportUploadError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{reportUploadError}</span>
              </div>
            )}

            {reportUploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{reportUploadSuccess}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReportModalApp(null)}
                disabled={isUploadingReport}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
              <Button
                type="button"
                disabled={!reportFile || isUploadingReport}
                onClick={handleUploadReportFile}
                className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 px-5 shadow-xs"
              >
                {isUploadingReport ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload &amp; Link Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── MODAL 3: UNCLAIM INSPECTION CASE CONFIRMATION MODAL ─── */}
      {unclaimTargetApp && (
        <Dialog
          isOpen={Boolean(unclaimTargetApp)}
          onClose={() => {
            if (!unclaimingId) {
              setUnclaimTargetApp(null);
              setUnclaimReason("");
            }
          }}
          title={`Unclaim Inspection Case: ${unclaimTargetApp.registrationNumber}`}
          description={`Release this vehicle inspection case back to the ${officerRegion} regional pool so another Technical Officer can claim it.`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 pt-1 text-slate-800 dark:text-zinc-200">
            {/* Case Summary Card */}
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-500">{unclaimTargetApp.id}</span>
                <Badge variant="warning" className="text-[10px]">
                  {unclaimTargetApp.inspectionMethod === "ON_SITE" ? "On-Site Visit" : "Office Station"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vehicle:</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">
                  {unclaimTargetApp.registrationNumber} ({unclaimTargetApp.make} {unclaimTargetApp.model})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Applicant:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {unclaimTargetApp.applicantName} ({unclaimTargetApp.applicantPhone})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Jurisdiction:</span>
                <span className="font-semibold">{unclaimTargetApp.storageRegion || officerRegion}</span>
              </div>
            </div>

            {/* Optional Handover / Release Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Reason for Releasing Case <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={unclaimReason}
                onChange={(e) => setUnclaimReason(e.target.value)}
                placeholder="e.g. Reassigning due to field schedule conflict, vehicle relocated to another station..."
                className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] focus:ring-2 focus:ring-rose-500 outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Once unclaimed, the case status resets to <strong>Pending Assignment</strong> and is immediately available in the regional pool.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(unclaimingId)}
                onClick={() => {
                  setUnclaimTargetApp(null);
                  setUnclaimReason("");
                }}
                className="rounded-xl text-xs h-9"
              >
                Keep Case
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(unclaimingId)}
                onClick={handleConfirmUnclaim}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white h-9 px-4 gap-1.5 shadow-sm"
              >
                {unclaimingId ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Releasing Case...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Confirm &amp; Unclaim Case</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── MODAL 4: LAYOFF CERTIFICATE & SCANNABLE QR CODE VIEWER ─── */}
      {certificateModalApp && (
        <Dialog
          isOpen={Boolean(certificateModalApp)}
          onClose={() => setCertificateModalApp(null)}
          title={`National Vehicle Lay-Off Certificate: ${certificateModalApp.registrationNumber}`}
          description={`Official statutory certificate and scannable verification QR code for ${certificateModalApp.id}.`}
          maxWidth="max-w-4xl"
        >
          <div className="max-h-[82vh] overflow-y-auto pr-1">
            <StatutoryCertificate
              application={certificateModalApp}
              onClose={() => setCertificateModalApp(null)}
            />
          </div>
        </Dialog>
      )}

      {/* ─── MODAL 5: PREVIOUS TECHNICAL OFFICER'S FIRST INSPECTION DOSSIER ─── */}
      {previousInspectionModal && (
        <Dialog
          isOpen={Boolean(previousInspectionModal)}
          onClose={() => setPreviousInspectionModal(null)}
          title={`First Inspection Dossier: ${previousInspectionModal.registrationNumber} (${previousInspectionModal.applicationId})`}
          description="Complete record of what the previous Technical Officer submitted during the initial physical inspection."
          maxWidth="max-w-3xl"
        >
          <div className="space-y-5 max-h-[78vh] overflow-y-auto pr-1 text-slate-800 dark:text-zinc-200 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-slate-500">Previous Officer</p>
                <p className="font-bold text-slate-900 dark:text-zinc-100">{previousInspectionModal.previousOfficerName}</p>
              </div>
              <div>
                <p className="text-slate-500">1st Inspection Date</p>
                <p className="font-bold text-slate-900 dark:text-zinc-100">{previousInspectionModal.firstInspectionDate}</p>
              </div>
              <div>
                <p className="text-slate-500">1st Inspection Outcome</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-400">{previousInspectionModal.firstInspectionOutcome}</p>
              </div>
              <div>
                <p className="text-slate-500">Vehicle</p>
                <p className="font-bold text-slate-900 dark:text-zinc-100">
                  {previousInspectionModal.make} {previousInspectionModal.model} ({previousInspectionModal.color || "Silver"})
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Detailed Description of First Inspection Findings
                </p>
                <p className="text-sm text-slate-900 dark:text-zinc-100 leading-relaxed">
                  {previousInspectionModal.firstInspectionFindings}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Defects &amp; Mechanical Observations Recorded (1st Inspection)
                </p>
                <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed">
                  {previousInspectionModal.firstInspectionDefects}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">
                First Inspection Camera Evidence ({previousInspectionModal.firstInspectionPhotos?.length || 0} Views)
              </p>
              {previousInspectionModal.firstInspectionPhotos?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {previousInspectionModal.firstInspectionPhotos.map((photoUrl: string, idx: number) => (
                    <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt={`1st Inspection Photo ${idx + 1}`} className="w-full h-36 object-cover" />
                      <div className="p-2 text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                        {INSPECTION_PHOTO_CATEGORIES[idx]?.label || `Inspection View ${idx + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-slate-500">
                  No camera photographs archived on initial record.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviousInspectionModal(null)}
                className="rounded-xl text-xs"
              >
                Close Dossier
              </Button>
              {previousInspectionModal.followUpStatus === "Pending Assignment" && (
                <Button
                  type="button"
                  onClick={() => {
                    const id = previousInspectionModal.applicationId;
                    setPreviousInspectionModal(null);
                    handleClaimFollowUp(id);
                  }}
                  className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Claim This Follow-Up Case
                </Button>
              )}
              {previousInspectionModal.followUpStatus === "In Progress" && (
                <Button
                  type="button"
                  onClick={() => {
                    const item = previousInspectionModal;
                    setPreviousInspectionModal(null);
                    handleOpenFollowUpInspection(item);
                  }}
                  className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Open Follow-Up Camera &amp; Findings Console
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── FLOATING TOAST NOTIFICATION ─── */}
      {claimFeedback && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full sm:w-auto animate-fade-in">
          <div
            className={cn(
              "p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-md",
              claimFeedback.type === "success"
                ? "bg-emerald-950/95 text-white border-emerald-500/50"
                : "bg-rose-950/95 text-white border-rose-500/50"
            )}
          >
            <div
              className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                claimFeedback.type === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
              )}
            >
              {claimFeedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-extrabold tracking-tight">
                {claimFeedback.title || (claimFeedback.type === "success" ? "Action Completed" : "Action Failed")}
              </p>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{claimFeedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setClaimFeedback(null)}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
