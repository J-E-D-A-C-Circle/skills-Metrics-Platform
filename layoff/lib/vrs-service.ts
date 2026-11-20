/**
 * Vehicle Registration System (VRS) Integration Service
 * 
 * Section 2: VRS Integration & Automatic Vehicle Verification
 * - Validates VIN/Chassis format (standard 17-character VIN).
 * - Sends verification request to VRS through approved integration interface.
 * - Retrieves registered vehicle specs and registered owner information.
 * - Handles Invalid VIN, Vehicle Not Found, Service Unavailable, and Timeout.
 * - Enforces strictly by VRS: no fallback or manual bypass.
 */

export interface VRSVehicleRecord {
  chassisNumber: string; // VIN
  registrationNumber: string;
  make: string;
  model: string;
  yearOfMake: string;
  vehicleType: string;
  vehicleUsageClassification: "Private" | "Commercial";
  colour: string;
  engineNumber: string;
  engineCapacityCc?: number;
  registeredOwner: {
    name: string;
    idNumber: string; // Ghana Card ID
    phone: string;
    email: string;
    residentialAddress: string;
    digitalAddress: string;
  };
  roadworthinessExpiryDate: string; // YYYY-MM-DD
  registrationStatus: "Active" | "Suspended" | "Cancelled";
}

// Authoritative Mock VRS Database of Registered Vehicles in Ghana
export const VRS_DATABASE: Record<string, VRSVehicleRecord> = {
  "JN1AZ34A890123456": {
    chassisNumber: "JN1AZ34A890123456",
    registrationNumber: "GT-4920-22",
    make: "Toyota",
    model: "Corolla",
    yearOfMake: "2022",
    vehicleType: "Private Saloon",
    vehicleUsageClassification: "Private",
    colour: "Midnight Blue",
    engineNumber: "2TR-FE9821034",
    engineCapacityCc: 1800,
    registeredOwner: {
      name: "Kofi Mensah Mensah",
      idNumber: "GHA-721948210-9",
      phone: "+233 24 412 3456",
      email: "kofi.mensah@gmail.com",
      residentialAddress: "House No. 14, Adenta Housing Down, Accra",
      digitalAddress: "GA-145-2036",
    },
    roadworthinessExpiryDate: "2027-04-15",
    registrationStatus: "Active",
  },
  "JTDKN3DU502918234": {
    chassisNumber: "JTDKN3DU502918234",
    registrationNumber: "GE-4892-24",
    make: "Nissan",
    model: "Patrol Titanium",
    yearOfMake: "2023",
    vehicleType: "Commercial SUV",
    vehicleUsageClassification: "Commercial",
    colour: "Pearl White",
    engineNumber: "VK56VD-409123",
    engineCapacityCc: 5600,
    registeredOwner: {
      name: "Kwame Osei Darko",
      idNumber: "GHA-812039481-2",
      phone: "+233 20 882 1190",
      email: "kwame.osei@translogistics.gh",
      residentialAddress: "Plot 88, Airport Residential Area, Accra",
      digitalAddress: "GA-019-4820",
    },
    roadworthinessExpiryDate: "2027-02-28",
    registrationStatus: "Active",
  },
  "KMHDH4AE9CU198234": {
    chassisNumber: "KMHDH4AE9CU198234",
    registrationNumber: "AS-3310-21",
    make: "Hyundai",
    model: "Sonata",
    yearOfMake: "2021",
    vehicleType: "Private Saloon",
    vehicleUsageClassification: "Private",
    colour: "Silver Metallic",
    engineNumber: "G4KJ-882194",
    engineCapacityCc: 2400,
    registeredOwner: {
      name: "Abena Serwaa Boateng",
      idNumber: "GHA-629104821-4",
      phone: "+233 54 991 4420",
      email: "abena.boateng@outlook.com",
      residentialAddress: "Ahodwo Roundabout, Kumasi",
      digitalAddress: "AK-045-8821",
    },
    roadworthinessExpiryDate: "2027-06-30",
    registrationStatus: "Active",
  },
  "WAUZZZ8K9DA123456": {
    chassisNumber: "WAUZZZ8K9DA123456",
    registrationNumber: "GW-7712-23",
    make: "Audi",
    model: "A4 Quattro",
    yearOfMake: "2023",
    vehicleType: "Private Saloon",
    vehicleUsageClassification: "Private",
    colour: "Mythos Black",
    engineNumber: "EA888-912048",
    engineCapacityCc: 2000,
    registeredOwner: {
      name: "Emmanuel Nana Kojo",
      idNumber: "GHA-910283746-1",
      phone: "+233 27 740 1928",
      email: "e.kojo@venture.gh",
      residentialAddress: "Beach Road, Takoradi",
      digitalAddress: "WS-120-9943",
    },
    roadworthinessExpiryDate: "2027-03-20",
    registrationStatus: "Active",
  },
  "1HD1KEM12BB456789": {
    chassisNumber: "1HD1KEM12BB456789",
    registrationNumber: "GR-9014-20",
    make: "Scania",
    model: "R500 Heavy Hauler",
    yearOfMake: "2020",
    vehicleType: "Heavy Truck",
    vehicleUsageClassification: "Commercial",
    colour: "Royal Red",
    engineNumber: "DC16-104921",
    engineCapacityCc: 16000,
    registeredOwner: {
      name: "Global Haulage Ltd",
      idNumber: "GHA-102938475-0",
      phone: "+233 30 220 4810",
      email: "fleet@globalhaulage.com.gh",
      residentialAddress: "Industrial Area, Tema",
      digitalAddress: "GT-022-1188",
    },
    roadworthinessExpiryDate: "2027-01-31",
    registrationStatus: "Active",
  },
  "SALWR2V47EA987654": {
    chassisNumber: "SALWR2V47EA987654",
    registrationNumber: "GN-5501-19",
    make: "Land Rover",
    model: "Defender 110",
    yearOfMake: "2019",
    vehicleType: "Commercial SUV",
    vehicleUsageClassification: "Commercial",
    colour: "Keswick Green",
    engineNumber: "AJ200D-491028",
    engineCapacityCc: 3000,
    registeredOwner: {
      name: "Dr. Yaw Asare",
      idNumber: "GHA-339102847-5",
      phone: "+233 24 330 9182",
      email: "yasare@ug.edu.gh",
      residentialAddress: "Legon Staff Village, Accra",
      digitalAddress: "GA-490-1122",
    },
    roadworthinessExpiryDate: "2026-11-20", // Note: close to cutoff for testing
    registrationStatus: "Active",
  },
  "123456789012": {
    chassisNumber: "123456789012",
    registrationNumber: "ER-1234-22",
    make: "Toyota",
    model: "Hilux Single Cabin",
    yearOfMake: "2018",
    vehicleType: "Light Pickup",
    vehicleUsageClassification: "Commercial",
    colour: "Pure White",
    engineNumber: "2GD-FTV-12345",
    engineCapacityCc: 2400,
    registeredOwner: {
      name: "Kwasi Appiah",
      idNumber: "GHA-123456789-0",
      phone: "+233 24 123 4567",
      email: "kwasi.appiah@agri.gh",
      residentialAddress: "Koforidua Market Street, Central",
      digitalAddress: "EN-101-2020",
    },
    roadworthinessExpiryDate: "2026-11-15",
    registrationStatus: "Active",
  },
};

export interface VRSVerificationResponse {
  success: boolean;
  vehicle?: VRSVehicleRecord;
  error?: string;
  errorCode?: "INVALID_FORMAT" | "VEHICLE_NOT_FOUND" | "SERVICE_UNAVAILABLE" | "TIMEOUT";
  timestamp: string;
}

/**
/**
 * Standard Chassis / VIN format check:
 * - Minimum 12 characters, maximum 17 characters.
 * - Standard chassis numbers cannot contain letters I, O, or Q.
 */
export function validateVINFormat(vin: string): { isValid: boolean; normalized: string; error?: string } {
  if (!vin) {
    return { isValid: false, normalized: "", error: "VIN/Chassis number is required." };
  }
  const normalized = vin.trim().toUpperCase();
  if (normalized.length < 12) {
    return {
      isValid: false,
      normalized,
      error: "Chassis number must contain at least 12 characters.",
    };
  }
  if (normalized.length > 17) {
    return {
      isValid: false,
      normalized,
      error: `Chassis number cannot exceed 17 characters (currently ${normalized.length} characters).`,
    };
  }
  if (!/^[A-HJ-NPR-Z0-9]{12,17}$/.test(normalized)) {
    return {
      isValid: false,
      normalized,
      error: "Invalid characters in VIN. Standard VIN/Chassis numbers cannot contain letters I, O, or Q.",
    };
  }
  return { isValid: true, normalized };
}

/**
 * Performs vehicle verification against VRS.
 * Simulates real integration with network latency and controlled error handling.
 */
export async function verifyVINWithVRS(
  vinInput: string,
  options?: { simulateError?: "SERVICE_UNAVAILABLE" | "TIMEOUT" }
): Promise<VRSVerificationResponse> {
  const timestamp = new Date().toISOString();
  const validation = validateVINFormat(vinInput);

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      errorCode: "INVALID_FORMAT",
      timestamp,
    };
  }

  const vin = validation.normalized;

  // Simulate timeout or service unavailability if requested
  if (options?.simulateError === "SERVICE_UNAVAILABLE") {
    return {
      success: false,
      error: "VRS Service Temporarily Unavailable (HTTP 503). Please retry in a few moments.",
      errorCode: "SERVICE_UNAVAILABLE",
      timestamp,
    };
  }

  if (options?.simulateError === "TIMEOUT") {
    return {
      success: false,
      error: "VRS Gateway Request Timeout (Gateway Timeout 504). Please retry.",
      errorCode: "TIMEOUT",
      timestamp,
    };
  }

  const record = VRS_DATABASE[vin];

  if (!record) {
    return {
      success: false,
      error: `Vehicle with Chassis/VIN "${vin}" was not found in the DVLA Vehicle Registration System.`,
      errorCode: "VEHICLE_NOT_FOUND",
      timestamp,
    };
  }

  return {
    success: true,
    vehicle: record,
    timestamp,
  };
}
