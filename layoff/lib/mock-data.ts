export interface LayoffApplication {
  id: string; // e.g. "LAY-2026-9042"
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string;
  idNumber: string; // Ghana Card ID
  residentialAddress?: string;
  digitalAddress?: string;

  // VRS & Ownership Details
  vrsVerified?: boolean;
  vrsVerificationDate?: string;
  applicantType?: "OWNER" | "REPRESENTATIVE";
  ownerName?: string;
  ownerIdNumber?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  representativeName?: string;
  representativePhone?: string;
  representativeEmail?: string;
  representativeIdType?: string;
  representativeIdNumber?: string;
  representativeRelationship?: string;
  representativeAddress?: string;
  representativeDocUrl?: string;

  // Vehicle Specifications
  registrationNumber: string; // e.g. "GE-4892-24"
  chassisNumber: string; // e.g. "JTDKN3DU502918234"
  engineNumber?: string;
  make: string;
  model: string;
  yearOfMake?: string;
  vehicleType: "Private Saloon" | "Commercial SUV" | "Heavy Truck" | "Motorcycle" | "Bus" | "Tricycle (Aboboyaa)" | "Light Pickup";
  colour: string;

  // Classification & Roadworthiness
  vehicleUsageClassification?: "Private" | "Commercial";
  roadworthinessExpiryDate?: string;
  roadworthinessCutoffDate?: string;
  roadworthinessValid?: boolean;
  isEmergencyMechanicalFailure?: boolean;
  emergencyFee?: number;
  emergencyFeeReason?: string;

  // Layoff Request Particulars
  reason: "Mechanical Failure / Overhaul" | "Extended Travel / Absenteeism" | "Commercial Inactivity" | "Vehicle Restoration / Repair" | "Legal Action" | "Other";
  explanation: string;
  storageFacilityName?: string;
  storageRegion?: string;
  proposedStartDate: string;
  layoffPeriodMonths: number;

  // Documents & Photos
  documents: { name: string; size: string; type: string; url?: string; category?: string }[];
  photos: string[]; // General or applicant photo URLs
  mandatoryPhotographs?: {
    front?: string;
    side?: string;
    rear?: string;
    engine?: string;
    chassis?: string;
  };

  // Inspection Workflow
  inspectionMethod?: "OFFICE" | "ON_SITE";
  inspectionOfficeLocation?: string;
  inspectionSiteAddress?: string;
  inspectionSiteArea?: string;
  inspectionContactPerson?: string;
  inspectionContactPhone?: string;
  inspectionNotes?: string;
  inspectionStatus?: "Pending Assignment" | "Assigned" | "In Progress" | "Completed" | "Requires Further Action";
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  claimedAt?: string;
  inspectionDate?: string;
  inspectionFindings?: string;
  inspectionDefects?: string;
  inspectionOutcome?: "Inspection completed successfully" | "Inspection completed with issues" | "Further inspection or information required";
  inspectionPhotos?: string[]; // Technical inspection photos
  inspectionReportSubmittedAt?: string;
  inspectionReportUrl?: string;
  inspectionReportFileName?: string;
  inspectionReportUploadedAt?: string;
  inspectionReportUploadedBy?: string;

  // Statuses (Separated Concepts)
  status:
    | "Draft"
    | "Submitted"
    | "Pending Verification"
    | "Verified"
    | "Pending Approval"
    | "Approved"
    | "Rejected"
    | "Invoice Generated"
    | "Active Layoff"
    | "Expiring Soon"
    | "Expired"
    | "Extended"
    | "Completed";
  applicationStatus?: "Draft" | "Submitted" | "Under Review" | "Pending Inspection" | "Inspection Completed" | "Approved" | "Rejected" | "Returned for Correction" | "Active" | "Completed" | "Expired";
  submittedAt: string;
  verificationOutcome?: "Verified" | "Requires Correction" | "Not Verified";
  verificationNote?: string;
  rejectionReason?: string;

  // Administrative Approval
  adminApprovalStatus?: "Pending" | "Approved" | "Rejected" | "Returned for Correction";
  adminApprovedBy?: string;
  adminApprovedAt?: string;
  adminComments?: string;

  // IPP Pro & Invoicing
  invoiceNumber?: string;
  invoiceStatus?: "Not Generated" | "Generated" | "Cancelled";
  paymentStatus?: "Pending" | "Paid" | "Failed" | "Cancelled";
  paymentReference?: string;
  paymentConfirmedAt?: string;
  ippProSubmissionStatus?: "Not Started" | "Pending" | "Succeeded" | "Failed" | "Pending Retry";
  ippProSubmissionRef?: string;
  ippProSubmittedAt?: string;
  ippProSubmissionError?: string;

  // Authoritative Vehicle Road Status (On Road | Off Road)
  vehicleRoadStatus?: "On Road" | "Off Road";
  roadStatusChangedAt?: string;
  roadStatusReason?: string;
  roadStatusChangedBy?: string;
  returnToRoadDate?: string;
  returnToRoadNotes?: string;

  // Dates & Extensions
  layoffStartDate?: string;
  layoffExpiryDate?: string;
  extensionCount?: number;
}

export interface Invoice {
  invoiceNumber: string; // e.g. "INV-DVLA-88109"
  applicationId: string;
  registrationNumber: string;
  chassisNumber: string;
  applicantName: string;
  amount: number; // in GH₵
  emergencyFee?: number; // Surcharge for emergency mechanical failure
  invoiceDate: string;
  layoffStartDate: string;
  layoffExpiryDate: string;
  paymentStatus: "Paid" | "Pending" | "Pending Payment" | "Waived";
  extensionStatus: "Eligible" | "Extended" | "Not Eligible" | "Expired";
  ippProTransactionRef?: string;
  billingDetails?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userRole: "Applicant" | "Representative" | "Technical Officer" | "DVLA Administrator" | "System Admin";
  userName: string;
  action: string;
  referenceNumber: string;
  vehicleReference?: string;
  previousStatus?: string;
  newStatus?: string;
  processIdentifier?: string;
  details: string;
}

export interface SMSNotification {
  id: string;
  recipientPhone: string;
  message: string;
  event:
    | "Application Submitted"
    | "Inspection Assigned"
    | "Inspection Completed"
    | "Application Approved"
    | "Invoice Generated"
    | "Payment Confirmed"
    | "Application Activated"
    | "Application Rejected"
    | "Correction Required"
    | "Expiry Notification"
    | "Return To Road"
    | "Extension Confirmed"
    | "OTP Code"
    | "24-Hour Case Reminder";
  sentAt: string;
  status: "Delivered" | "Pending";
}

export function formatLayoffReferenceId(registrationNumber: string, yearOrDate?: string | number): string {
  const cleanReg = (registrationNumber || "VEHICLE").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const year = yearOrDate
    ? String(yearOrDate).slice(0, 4)
    : String(new Date().getFullYear());
  return `LAY-${year}-${cleanReg}`;
}

export const INITIAL_APPLICATIONS: LayoffApplication[] = [
  {
    id: "LAY-2026-GT492022",
    applicantName: "Kofi Mensah Mensah",
    applicantPhone: "+233 24 412 3456",
    applicantEmail: "kofi.mensah@gmail.com",
    idNumber: "GHA-721948210-9",
    residentialAddress: "House No. 14, Adenta Housing Down, Accra",
    digitalAddress: "GA-145-2036",

    vrsVerified: true,
    vrsVerificationDate: "2026-09-01 10:15",
    applicantType: "OWNER",
    ownerName: "Kofi Mensah Mensah",
    ownerIdNumber: "GHA-721948210-9",
    ownerPhone: "+233 24 412 3456",
    ownerEmail: "kofi.mensah@gmail.com",

    registrationNumber: "GT-4920-22",
    chassisNumber: "JN1AZ34A890123456",
    engineNumber: "2TR-FE9821034",
    make: "Toyota",
    model: "Corolla",
    yearOfMake: "2022",
    vehicleType: "Private Saloon",
    colour: "Midnight Blue",

    vehicleUsageClassification: "Private",
    roadworthinessExpiryDate: "2027-04-15",
    roadworthinessCutoffDate: "2026-12-01",
    roadworthinessValid: true,

    reason: "Mechanical Failure / Overhaul",
    explanation: "Engine block overhaul required. Major crankshaft replacement in progress at Suame Magazine workshop. Parts imported from abroad expected in 3 months.",
    storageFacilityName: "Suame Magazine Master Auto Workshop, Zone B",
    storageRegion: "Ashanti",
    proposedStartDate: "2026-09-01",
    layoffPeriodMonths: 6,

    inspectionMethod: "OFFICE",
    inspectionOfficeLocation: "DVLA 37 Head Office - Accra",
    inspectionStatus: "Completed",
    assignedOfficerId: "TO-409",
    assignedOfficerName: "Ing. Samuel Annan",
    inspectionDate: "2026-09-02",
    inspectionFindings: "Physical inspection at 37 Office confirms vehicle is immobilised with stripped engine block. Odometer verified at 84,210 km.",
    inspectionOutcome: "Inspection completed successfully",
    inspectionReportSubmittedAt: "2026-09-02 14:30",

    documents: [
      { name: "Vehicle_Registration_Document_Title.pdf", size: "2.1 MB", type: "PDF", category: "document_title" },
      { name: "Mechanic_Inspection_Report.pdf", size: "1.4 MB", type: "PDF", category: "document" },
      { name: "Workshop_Parts_Invoice.pdf", size: "890 KB", type: "PDF", category: "document" },
    ],
    photos: [
      "/placeholder-car-front.jpg",
      "/placeholder-car-side.jpg",
      "/placeholder-car-rear.jpg",
      "/placeholder-car-engine.jpg",
      "/placeholder-car-chassis.jpg",
    ],
    mandatoryPhotographs: {
      front: "/placeholder-car-front.jpg",
      side: "/placeholder-car-side.jpg",
      rear: "/placeholder-car-rear.jpg",
      engine: "/placeholder-car-engine.jpg",
      chassis: "/placeholder-car-chassis.jpg",
    },
    inspectionPhotos: [
      "/placeholder-inspection-1.jpg",
    ],

    status: "Active Layoff",
    applicationStatus: "Active",
    submittedAt: "2026-09-01 11:24",
    verificationOutcome: "Verified",
    verificationNote: "VIN verified via VRS. Physical inspection passed at 37 Office.",

    adminApprovalStatus: "Approved",
    adminApprovedBy: "Chief Supt. Osei Tutu",
    adminApprovedAt: "2026-09-03 09:12",

    invoiceNumber: "INV-DVLA-88109",
    invoiceStatus: "Generated",
    paymentStatus: "Paid",
    paymentReference: "PAY-IPP-99201948",
    paymentConfirmedAt: "2026-09-03 10:45",
    ippProSubmissionStatus: "Succeeded",
    ippProSubmissionRef: "IPP-DATA-REC-884102",
    ippProSubmittedAt: "2026-09-03 10:46",

    vehicleRoadStatus: "Off Road",
    roadStatusChangedAt: "2026-09-03 10:45",
    roadStatusReason: "Layoff application paid and activated under Regulation 48.",
    roadStatusChangedBy: "IPP Pro Payment Gateway",

    layoffStartDate: "2026-09-01",
    layoffExpiryDate: "2027-03-01",
    extensionCount: 0,
  },
  {
    id: "LAY-2026-GE489224",
    applicantName: "Yaw Boateng (Rep)",
    applicantPhone: "+233 50 119 2834",
    applicantEmail: "yaw.boateng@rep-services.gh",
    idNumber: "GHA-882019481-3",
    residentialAddress: "Flat 4B, Cantonments Court, Accra",
    digitalAddress: "GL-021-9988",

    vrsVerified: true,
    vrsVerificationDate: "2026-10-10 14:02",
    applicantType: "REPRESENTATIVE",
    ownerName: "Kwame Osei Darko",
    ownerIdNumber: "GHA-812039481-2",
    ownerPhone: "+233 20 882 1190",
    ownerEmail: "kwame.osei@translogistics.gh",
    representativeName: "Yaw Boateng",
    representativePhone: "+233 50 119 2834",
    representativeEmail: "yaw.boateng@rep-services.gh",
    representativeIdType: "Ghana Card",
    representativeIdNumber: "GHA-882019481-3",
    representativeRelationship: "Authorized Fleet Manager",
    representativeAddress: "Flat 4B, Cantonments Court, Accra",

    registrationNumber: "GE-4892-24",
    chassisNumber: "JTDKN3DU502918234",
    engineNumber: "VK56VD-409123",
    make: "Nissan",
    model: "Patrol Titanium",
    yearOfMake: "2023",
    vehicleType: "Commercial SUV",
    colour: "Pearl White",

    vehicleUsageClassification: "Commercial",
    roadworthinessExpiryDate: "2027-02-28",
    roadworthinessCutoffDate: "2026-12-10",
    roadworthinessValid: true,

    reason: "Extended Travel / Absenteeism",
    explanation: "Fleet vehicle laid off due to international deployment of executive staff. Vehicle will be safely housed in commercial bonded warehouse.",
    storageFacilityName: "Tema Port Bonded Warehouse 4",
    storageRegion: "Greater Accra",
    proposedStartDate: "2026-10-15",
    layoffPeriodMonths: 6,

    inspectionMethod: "ON_SITE",
    inspectionSiteAddress: "Plot 12 Heavy Industrial Area, Warehouse 4",
    inspectionSiteArea: "Tema Industrial",
    inspectionContactPerson: "Security Commander Mensah",
    inspectionContactPhone: "+233 20 551 0928",
    inspectionNotes: "Call warehouse commander 30 mins before arrival at Gate 2.",
    inspectionStatus: "Completed",
    assignedOfficerId: "TO-204",
    assignedOfficerName: "Ing. Beatrice Arthur",
    inspectionDate: "2026-10-11",
    inspectionFindings: "On-site inspection at Tema Port Bonded Warehouse 4 confirms Nissan Patrol Titanium (VIN: JTDKN3DU502918234) is securely grounded off public roads inside Bay 4B.",
    inspectionOutcome: "Inspection completed successfully",
    inspectionReportSubmittedAt: "2026-10-11 15:20",

    documents: [
      { name: "Vehicle_Registration_Document_Title.pdf", size: "1.8 MB", type: "PDF", category: "document_title" },
      { name: "Power_Of_Attorney_Authorization.pdf", size: "950 KB", type: "PDF", category: "representative_auth" },
      { name: "Warehouse_Storage_Lease.pdf", size: "1.1 MB", type: "PDF", category: "document" },
    ],
    photos: [
      "/placeholder-car-front.jpg",
      "/placeholder-car-side.jpg",
      "/placeholder-car-rear.jpg",
      "/placeholder-car-engine.jpg",
      "/placeholder-car-chassis.jpg",
    ],
    mandatoryPhotographs: {
      front: "/placeholder-car-front.jpg",
      side: "/placeholder-car-side.jpg",
      rear: "/placeholder-car-rear.jpg",
      engine: "/placeholder-car-engine.jpg",
      chassis: "/placeholder-car-chassis.jpg",
    },

    status: "Active Layoff",
    applicationStatus: "Active",
    submittedAt: "2026-10-10 16:48",
    verificationOutcome: "Verified",
    verificationNote: "VIN verified via VRS. On-site bonded warehouse inspection passed at Tema Industrial.",

    adminApprovalStatus: "Approved",
    adminApprovedBy: "Chief Supt. Osei Tutu",
    adminApprovedAt: "2026-10-12 09:45",

    invoiceNumber: "INV-DVLA-77319",
    invoiceStatus: "Generated",
    paymentStatus: "Paid",
    paymentReference: "PAY-IPP-77319842",
    paymentConfirmedAt: "2026-10-12 11:30",
    ippProSubmissionStatus: "Succeeded",
    ippProSubmissionRef: "IPP-DATA-REC-773109",
    ippProSubmittedAt: "2026-10-12 11:32",

    vehicleRoadStatus: "Off Road",
    roadStatusChangedAt: "2026-10-12 11:30",
    roadStatusReason: "Layoff application paid and activated under Regulation 28.",
    roadStatusChangedBy: "IPP Pro Payment Gateway",

    layoffStartDate: "2026-10-15",
    layoffExpiryDate: "2027-04-15",
    extensionCount: 0,
  },
  {
    id: "LAY-2026-AS331021",
    applicantName: "Abena Serwaa Boateng",
    applicantPhone: "+233 54 991 4420",
    applicantEmail: "abena.boateng@outlook.com",
    idNumber: "GHA-629104821-4",
    residentialAddress: "Ahodwo Roundabout, Kumasi",
    digitalAddress: "AK-045-8821",

    vrsVerified: true,
    vrsVerificationDate: "2026-10-12 09:30",
    applicantType: "OWNER",
    ownerName: "Abena Serwaa Boateng",
    ownerIdNumber: "GHA-629104821-4",
    ownerPhone: "+233 54 991 4420",
    ownerEmail: "abena.boateng@outlook.com",

    registrationNumber: "AS-3310-21",
    chassisNumber: "KMHDH4AE9CU198234",
    engineNumber: "G4KJ-882194",
    make: "Hyundai",
    model: "Sonata",
    yearOfMake: "2021",
    vehicleType: "Private Saloon",
    colour: "Silver Metallic",

    vehicleUsageClassification: "Private",
    roadworthinessExpiryDate: "2027-06-30",
    roadworthinessCutoffDate: "2027-01-12",
    roadworthinessValid: true,

    reason: "Vehicle Restoration / Repair",
    explanation: "Complete suspension and body restoration. Vehicle garaged in private residence compound.",
    storageFacilityName: "Private Residential Garage",
    storageRegion: "Ashanti",
    proposedStartDate: "2026-10-15",
    layoffPeriodMonths: 6,

    inspectionMethod: "OFFICE",
    inspectionOfficeLocation: "DVLA Kumasi Regional Office",
    inspectionStatus: "Completed",
    assignedOfficerId: "TO-102",
    assignedOfficerName: "Ing. Kwame Appiah",
    inspectionDate: "2026-10-13",
    inspectionFindings: "Vehicle inspected. Body restoration verified. Chassis VIN matches VRS database.",
    inspectionOutcome: "Inspection completed successfully",
    inspectionReportSubmittedAt: "2026-10-13 11:00",

    documents: [
      { name: "Vehicle_Registration_Document_Title.pdf", size: "2.3 MB", type: "PDF", category: "document_title" },
    ],
    photos: [
      "/placeholder-car-front.jpg",
      "/placeholder-car-side.jpg",
      "/placeholder-car-rear.jpg",
      "/placeholder-car-engine.jpg",
      "/placeholder-car-chassis.jpg",
    ],
    mandatoryPhotographs: {
      front: "/placeholder-car-front.jpg",
      side: "/placeholder-car-side.jpg",
      rear: "/placeholder-car-rear.jpg",
      engine: "/placeholder-car-engine.jpg",
      chassis: "/placeholder-car-chassis.jpg",
    },

    status: "Pending Approval",
    applicationStatus: "Inspection Completed",
    submittedAt: "2026-10-12 10:15",
    verificationOutcome: "Verified",
    verificationNote: "Ready for administrative approval and IPP Pro invoice generation.",

    adminApprovalStatus: "Pending",
    invoiceStatus: "Not Generated",
    paymentStatus: "Pending",
    ippProSubmissionStatus: "Not Started",
    vehicleRoadStatus: "On Road",
    extensionCount: 0,
  },
  {
    id: "LAY-2026-GS891023",
    applicantName: "Barrister Felix Quaye",
    applicantPhone: "+233 24 551 8892",
    applicantEmail: "f.quaye@quayechambers.com",
    idNumber: "GHA-551029381-1",
    residentialAddress: "Ridge Residential Area, Accra",
    digitalAddress: "GA-019-3321",

    vrsVerified: true,
    vrsVerificationDate: "2026-10-18 11:20",
    applicantType: "OWNER",
    ownerName: "Barrister Felix Quaye",
    ownerIdNumber: "GHA-551029381-1",
    ownerPhone: "+233 24 551 8892",
    ownerEmail: "f.quaye@quayechambers.com",

    registrationNumber: "GS-8910-23",
    chassisNumber: "1HD1KEM12BB456789",
    engineNumber: "DC13-115-4091",
    make: "Scania",
    model: "G460 Heavy Haulage",
    yearOfMake: "2023",
    vehicleType: "Heavy Truck",
    colour: "Signal Yellow",

    vehicleUsageClassification: "Commercial",
    roadworthinessExpiryDate: "2027-01-30",
    roadworthinessCutoffDate: "2026-12-18",
    roadworthinessValid: true,

    reason: "Legal Action",
    explanation: "Vehicle is subject to pending High Court commercial litigation (Suit No: Comm/0481/2026). Injunction order restrains vehicle operation on public roads pending resolution.",
    storageFacilityName: "Quaye Haulage Yard, Spintex Road",
    storageRegion: "Greater Accra",
    proposedStartDate: "2026-10-20",
    layoffPeriodMonths: 12,

    inspectionMethod: "ON_SITE",
    inspectionSiteAddress: "Plot 8B Spintex Road, Quaye Logistics Yard",
    inspectionSiteArea: "Spintex",
    inspectionContactPerson: "Yard Marshal Tetteh",
    inspectionContactPhone: "+233 24 991 0021",
    inspectionStatus: "Completed",
    assignedOfficerId: "TO-304",
    assignedOfficerName: "Insp. Emmanuel Darko",
    inspectionDate: "2026-10-20",
    inspectionFindings: "On-site inspection completed. Commercial Scania prime mover parked in secure yard under judicial restraint notice. Chassis 1HD1KEM12BB456789 verified with device camera.",
    inspectionOutcome: "Inspection completed successfully",
    inspectionReportUrl: "/api/uploads/Scania_Inspection_Report_Darko.pdf",
    inspectionReportFileName: "Scania_G460_Inspection_Report.pdf",
    inspectionReportUploadedAt: "2026-10-20 16:30",
    inspectionReportUploadedBy: "Insp. Emmanuel Darko",

    documents: [
      { name: "Vehicle_Registration_Document_Title.pdf", size: "2.4 MB", type: "PDF", category: "document_title" },
      { name: "High_Court_Injunction_Order.pdf", size: "1.8 MB", type: "PDF", category: "legal_document" },
      { name: "Scania_G460_Inspection_Report.pdf", size: "1.9 MB", type: "PDF", category: "inspection_report" },
    ],
    photos: [
      "/placeholder-car-front.jpg",
      "/placeholder-car-side.jpg",
      "/placeholder-car-rear.jpg",
      "/placeholder-car-engine.jpg",
      "/placeholder-car-chassis.jpg",
    ],
    inspectionPhotos: [
      "/placeholder-inspection-front.jpg",
      "/placeholder-inspection-side.jpg",
      "/placeholder-inspection-rear.jpg",
      "/placeholder-inspection-engine.jpg",
      "/placeholder-inspection-chassis.jpg",
    ],

    status: "Pending Approval",
    applicationStatus: "Inspection Completed",
    submittedAt: "2026-10-18 12:45",
    adminApprovalStatus: "Pending",
    invoiceStatus: "Not Generated",
    paymentStatus: "Pending",
    vehicleRoadStatus: "On Road",
    extensionCount: 0,
  },
  {
    id: "LAY-2026-GN771423",
    applicantName: "Constance Ohene (Rep)",
    applicantPhone: "+233 20 441 9901",
    applicantEmail: "c.ohene@primefleet.com",
    idNumber: "GHA-441092819-8",
    residentialAddress: "Tema Community 6, House 12",
    digitalAddress: "GT-048-1192",

    vrsVerified: true,
    vrsVerificationDate: "2026-10-21 08:30",
    applicantType: "REPRESENTATIVE",
    ownerName: "Alhaji Rashid Mohammed",
    ownerIdNumber: "GHA-339102847-2",
    ownerPhone: "+233 24 330 9182",
    ownerEmail: "rashid.m@alrashid.gh",
    representativeName: "Constance Ohene",
    representativePhone: "+233 20 441 9901",
    representativeEmail: "c.ohene@primefleet.com",
    representativeIdType: "Ghana Card",
    representativeIdNumber: "GHA-441092819-8",
    representativeRelationship: "Corporate Fleet Operations Officer",
    representativeAddress: "Tema Community 6, House 12",

    registrationNumber: "GN-7714-23",
    chassisNumber: "123456789012",
    engineNumber: "1GD-FTV-99210",
    make: "Toyota",
    model: "Hilux Double Cabin",
    yearOfMake: "2023",
    vehicleType: "Light Pickup",
    colour: "Graphite Grey",

    vehicleUsageClassification: "Commercial",
    roadworthinessExpiryDate: "2026-11-15",
    roadworthinessCutoffDate: "2026-12-21",
    roadworthinessValid: true,
    isEmergencyMechanicalFailure: true,
    emergencyFee: 200,
    emergencyFeeReason: "Emergency Mechanical Failure: Commercial vehicle has less than 2 months roadworthiness validity remaining (Expires: 2026-11-15, Cutoff: 2026-12-21). Emergency surcharge applied.",

    reason: "Mechanical Failure / Overhaul",
    explanation: "Severe cylinder head gasket crack and water pump failure during transit. Vehicle immobilized immediately to prevent engine seizure.",
    storageFacilityName: "Toyota Ghana Specialized Service Center - Tema",
    storageRegion: "Greater Accra",
    proposedStartDate: "2026-10-21",
    layoffPeriodMonths: 6,

    inspectionMethod: "OFFICE",
    inspectionOfficeLocation: "DVLA Tema Regional Station",
    inspectionStatus: "Completed",
    assignedOfficerId: "TO-409",
    assignedOfficerName: "Ing. Samuel Annan",
    inspectionDate: "2026-10-22",
    inspectionFindings: "Vehicle towed to Tema testing center. Engine block disassembled with water contamination. 12-character chassis 123456789012 matches VRS authoritative record.",
    inspectionOutcome: "Inspection completed successfully",
    inspectionReportUrl: "/api/uploads/Hilux_Emergency_Inspection_Report.pdf",
    inspectionReportFileName: "Hilux_Emergency_Report_TO409.pdf",
    inspectionReportUploadedAt: "2026-10-22 15:40",
    inspectionReportUploadedBy: "Ing. Samuel Annan",

    documents: [
      { name: "Vehicle_Registration_Document_Title.pdf", size: "2.1 MB", type: "PDF", category: "document_title" },
      { name: "Owner_Authorization_Letter_Alhaji_Rashid.pdf", size: "1.2 MB", type: "PDF", category: "representative_auth" },
      { name: "Toyota_Diagnostic_Mechanical_Report.pdf", size: "1.6 MB", type: "PDF", category: "document" },
      { name: "Hilux_Emergency_Report_TO409.pdf", size: "1.7 MB", type: "PDF", category: "inspection_report" },
    ],
    photos: [
      "/placeholder-car-front.jpg",
      "/placeholder-car-side.jpg",
      "/placeholder-car-rear.jpg",
      "/placeholder-car-engine.jpg",
      "/placeholder-car-chassis.jpg",
    ],
    inspectionPhotos: [
      "/placeholder-inspection-front.jpg",
      "/placeholder-inspection-side.jpg",
      "/placeholder-inspection-rear.jpg",
      "/placeholder-inspection-engine.jpg",
      "/placeholder-inspection-chassis.jpg",
    ],

    status: "Pending Approval",
    applicationStatus: "Inspection Completed",
    submittedAt: "2026-10-21 09:15",
    adminApprovalStatus: "Pending",
    invoiceStatus: "Not Generated",
    paymentStatus: "Pending",
    vehicleRoadStatus: "On Road",
    extensionCount: 0,
  },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    invoiceNumber: "INV-DVLA-88109",
    applicationId: "LAY-2026-GT492022",
    registrationNumber: "GT-4920-22",
    chassisNumber: "JN1AZ34A890123456",
    applicantName: "Kofi Mensah Mensah",
    amount: 150,
    invoiceDate: "2026-09-03",
    layoffStartDate: "2026-09-01",
    layoffExpiryDate: "2027-03-01",
    paymentStatus: "Paid",
    extensionStatus: "Eligible",
    ippProTransactionRef: "IPP-TXN-881092-491",
  },
  {
    invoiceNumber: "INV-DVLA-77319",
    applicationId: "LAY-2026-GE489224",
    registrationNumber: "GE-4892-24",
    chassisNumber: "JTDKN3DU502918234",
    applicantName: "Kwame Osei Darko (Rep: Yaw Boateng)",
    amount: 350,
    invoiceDate: "2026-10-12",
    layoffStartDate: "2026-10-15",
    layoffExpiryDate: "2027-04-15",
    paymentStatus: "Paid",
    extensionStatus: "Eligible",
    ippProTransactionRef: "IPP-TXN-773198-420",
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: "LOG-2026-001",
    timestamp: "2026-09-01 10:15:20",
    userRole: "Applicant",
    userName: "Kofi Mensah Mensah",
    action: "VRS_VEHICLE_VERIFIED",
    referenceNumber: "LAY-2026-8810",
    vehicleReference: "GT-4920-22",
    processIdentifier: "VRS_GATEWAY",
    details: "VIN JN1AZ34A890123456 verified successfully against VRS. Populated Toyota Corolla particulars.",
  },
  {
    id: "LOG-2026-002",
    timestamp: "2026-09-02 14:30:11",
    userRole: "Technical Officer",
    userName: "Ing. Samuel Annan",
    action: "TECHNICAL_INSPECTION_SUBMITTED",
    referenceNumber: "LAY-2026-8810",
    vehicleReference: "GT-4920-22",
    processIdentifier: "INSPECTION_MODULE",
    details: "Office inspection conducted at 37 Head Office. Outcome: Inspection completed successfully.",
  },
  {
    id: "LOG-2026-003",
    timestamp: "2026-09-03 09:12:45",
    userRole: "DVLA Administrator",
    userName: "Chief Supt. Osei Tutu",
    action: "APPLICATION_APPROVED",
    referenceNumber: "LAY-2026-8810",
    vehicleReference: "GT-4920-22",
    processIdentifier: "ADMIN_CONSOLE",
    previousStatus: "Pending Approval",
    newStatus: "Approved",
    details: "Administrative approval granted. Approval is not activation; invoice generation initiated.",
  },
  {
    id: "LOG-2026-004",
    timestamp: "2026-09-03 09:13:02",
    userRole: "System Admin",
    userName: "IPP Pro Integration Daemon",
    action: "INVOICE_GENERATED_IPP_PRO",
    referenceNumber: "LAY-2026-8810",
    vehicleReference: "GT-4920-22",
    processIdentifier: "IPP_PRO_GATEWAY",
    details: "Generated invoice INV-DVLA-88109 (GH₵ 150.00). Ref: IPP-TXN-881092-491.",
  },
  {
    id: "LOG-2026-005",
    timestamp: "2026-09-03 10:45:19",
    userRole: "System Admin",
    userName: "IPP Pro Payment Gateway",
    action: "PAYMENT_CONFIRMED_AND_ACTIVATED",
    referenceNumber: "LAY-2026-8810",
    vehicleReference: "GT-4920-22",
    processIdentifier: "IPP_PRO_GATEWAY",
    previousStatus: "Pending",
    newStatus: "Paid",
    details: "Payment confirmed (Ref: PAY-IPP-99201948). Layoff activated. Vehicle road status transitioned to Off Road.",
  },
  {
    id: "LOG-2026-006",
    timestamp: "2026-09-03 10:46:05",
    userRole: "System Admin",
    userName: "IPP Pro Integration Daemon",
    action: "IPP_PRO_DATA_SUBMITTED",
    referenceNumber: "LAY-2026-8810",
    vehicleReference: "GT-4920-22",
    processIdentifier: "IPP_PRO_DATA_SYNC",
    details: "Successfully submitted confirmed application data to IPP Pro. Reference: IPP-DATA-REC-884102.",
  },
];

export const INITIAL_SMS_NOTIFICATIONS: SMSNotification[] = [
  {
    id: "SMS-881091",
    recipientPhone: "+233 24 412 3456",
    message: "DVLA NOTICE: Layoff application LAY-2026-8810 for GT-4920-22 approved. Invoice INV-DVLA-88109 of GH₵ 150.00 generated.",
    event: "Invoice Generated",
    sentAt: "2026-09-03 09:14",
    status: "Delivered",
  },
  {
    id: "SMS-881092",
    recipientPhone: "+233 24 412 3456",
    message: "DVLA NOTICE: Payment received. Vehicle GT-4920-22 is now legally laid off (Off Road) until 2027-03-01. Thank you.",
    event: "Application Activated",
    sentAt: "2026-09-03 10:47",
    status: "Delivered",
  },
];
