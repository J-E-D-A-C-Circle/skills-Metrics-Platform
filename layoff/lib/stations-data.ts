export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Eastern",
  "Central",
  "Northern",
  "Volta",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
  "Oti",
  "Savannah",
  "North East",
  "Western North",
];

export interface DVLAStation {
  id: string;
  name: string;
  code: string;
  region: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt?: string;
}

export const DEFAULT_DVLA_STATIONS: DVLAStation[] = [
  {
    id: "stn-acc-37",
    name: "DVLA 37 Head Office",
    code: "DVLA-GAR-01",
    region: "Greater Accra",
    address: "Jawaharlal Nehru Road, 37 Military Hospital Area, Accra",
    phone: "+233 30 274 6760",
    isActive: true,
  },
  {
    id: "stn-acc-weija",
    name: "Weija District Office",
    code: "DVLA-GAR-02",
    region: "Greater Accra",
    address: "Mallam-Kasoa Highway, Weija, Accra",
    phone: "+233 30 285 1120",
    isActive: true,
  },
  {
    id: "stn-acc-tema",
    name: "Tema Regional Office",
    code: "DVLA-GAR-03",
    region: "Greater Accra",
    address: "Community 4, Near Tema Port, Tema",
    phone: "+233 30 320 4192",
    isActive: true,
  },
  {
    id: "stn-acc-spintex",
    name: "Spintex / Batsonaa Operational Office",
    code: "DVLA-GAR-04",
    region: "Greater Accra",
    address: "Spintex Road, Batsonaa, Accra",
    phone: "+233 30 281 4410",
    isActive: true,
  },
  {
    id: "stn-ash-kumasi",
    name: "Kumasi Central Office",
    code: "DVLA-ASH-01",
    region: "Ashanti",
    address: "Oforikrom / Tech Junction, Kumasi",
    phone: "+233 32 202 4190",
    isActive: true,
  },
  {
    id: "stn-ash-mampong",
    name: "Mampong District Office",
    code: "DVLA-ASH-02",
    region: "Ashanti",
    address: "Mampong-Ashanti Highway, Mampong",
    phone: "+233 32 222 0811",
    isActive: true,
  },
  {
    id: "stn-ash-obuasi",
    name: "Obuasi Station",
    code: "DVLA-ASH-03",
    region: "Ashanti",
    address: "Obuasi Municipal Area",
    phone: "+233 32 254 0219",
    isActive: true,
  },
  {
    id: "stn-wes-takoradi",
    name: "Takoradi Regional Office",
    code: "DVLA-WES-01",
    region: "Western",
    address: "Sekondi-Takoradi Road, Takoradi",
    phone: "+233 31 202 3104",
    isActive: true,
  },
  {
    id: "stn-wes-tarkwa",
    name: "Tarkwa District Station",
    code: "DVLA-WES-02",
    region: "Western",
    address: "Tarkwa Municipal",
    phone: "+233 31 232 0415",
    isActive: true,
  },
  {
    id: "stn-eas-koforidua",
    name: "Koforidua Regional Office",
    code: "DVLA-EAS-01",
    region: "Eastern",
    address: "Effiduase, Koforidua",
    phone: "+233 34 202 2510",
    isActive: true,
  },
  {
    id: "stn-eas-nkawkaw",
    name: "Nkawkaw Station",
    code: "DVLA-EAS-02",
    region: "Eastern",
    address: "Accra-Kumasi Highway, Nkawkaw",
    phone: "+233 34 312 2098",
    isActive: true,
  },
  {
    id: "stn-cen-capecoast",
    name: "Cape Coast Regional Office",
    code: "DVLA-CEN-01",
    region: "Central",
    address: "Pedu Junction, Cape Coast",
    phone: "+233 33 213 2418",
    isActive: true,
  },
  {
    id: "stn-cen-winneba",
    name: "Winneba District Station",
    code: "DVLA-CEN-02",
    region: "Central",
    address: "Winneba Junction",
    phone: "+233 33 232 2109",
    isActive: true,
  },
  {
    id: "stn-nor-tamale",
    name: "Tamale Regional Office",
    code: "DVLA-NOR-01",
    region: "Northern",
    address: "Bolgatanga Road, Tamale",
    phone: "+233 37 202 2814",
    isActive: true,
  },
  {
    id: "stn-vol-ho",
    name: "Ho Regional Office",
    code: "DVLA-VOL-01",
    region: "Volta",
    address: "Barracks Road, Ho",
    phone: "+233 36 202 6412",
    isActive: true,
  },
  {
    id: "stn-bon-sunyani",
    name: "Sunyani Regional Office",
    code: "DVLA-BON-01",
    region: "Bono",
    address: "Berekum Road, Sunyani",
    phone: "+233 35 202 7105",
    isActive: true,
  },
  {
    id: "stn-uea-bolga",
    name: "Bolgatanga Regional Office",
    code: "DVLA-UEA-01",
    region: "Upper East",
    address: "Navrongo Road, Bolgatanga",
    phone: "+233 38 202 2319",
    isActive: true,
  },
  {
    id: "stn-uwe-wa",
    name: "Wa Regional Office",
    code: "DVLA-UWE-01",
    region: "Upper West",
    address: "Kpaguri, Wa",
    phone: "+233 39 202 2180",
    isActive: true,
  },
];

export function groupStationsByRegion(stations: DVLAStation[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const reg of GHANA_REGIONS) {
    grouped[reg] = [];
  }
  for (const s of stations) {
    if (!s.isActive) continue;
    if (!grouped[s.region]) {
      grouped[s.region] = [];
    }
    if (!grouped[s.region].includes(s.name)) {
      grouped[s.region].push(s.name);
    }
  }
  return grouped;
}

