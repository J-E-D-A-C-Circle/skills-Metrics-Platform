import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";
import {
  DEFAULT_DVLA_STATIONS,
  DVLAStation,
  groupStationsByRegion,
} from "@/lib/stations-data";

const STATIONS_CONFIG_KEY = "DVLA_STATIONS_REGISTRY";

// In-memory cache fallback when DB is unreachable
let memoryStationsCache: DVLAStation[] | null = null;

async function loadStationsFromStore(): Promise<DVLAStation[]> {
  try {
    const cfg = await db.systemConfig.findUnique({
      where: { configKey: STATIONS_CONFIG_KEY },
    });
    if (cfg && cfg.configValue) {
      const parsed = JSON.parse(cfg.configValue);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryStationsCache = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to memory cache or default stations
  }

  if (memoryStationsCache && memoryStationsCache.length > 0) {
    return memoryStationsCache;
  }

  return [...DEFAULT_DVLA_STATIONS];
}

async function saveStationsToStore(stations: DVLAStation[], updatedBy: string): Promise<void> {
  memoryStationsCache = stations;
  try {
    await db.systemConfig.upsert({
      where: { configKey: STATIONS_CONFIG_KEY },
      update: {
        configValue: JSON.stringify(stations),
        description: "Official Registry of DVLA Regional & District Operational Stations",
        updatedBy,
      },
      create: {
        configKey: STATIONS_CONFIG_KEY,
        configValue: JSON.stringify(stations),
        description: "Official Registry of DVLA Regional & District Operational Stations",
        updatedBy,
      },
    });
  } catch (err) {
    console.warn("Saved DVLA stations to in-memory cache (DB unavailable):", err);
  }
}

export async function GET() {
  try {
    const stations = await loadStationsFromStore();
    return NextResponse.json({
      stations,
      byRegion: groupStationsByRegion(stations),
    });
  } catch (error) {
    console.error("Failed to load DVLA stations:", error);
    return NextResponse.json({
      stations: DEFAULT_DVLA_STATIONS,
      byRegion: groupStationsByRegion(DEFAULT_DVLA_STATIONS),
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionUserFromRequest(req);
    if (session && session.role !== "ADMINISTRATOR") {
      return NextResponse.json(
        { error: "Only Administrators can register new DVLA stations." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, region, code, address, phone } = body;

    const cleanName = (name || "").trim();
    const cleanRegion = (region || "").trim();

    if (!cleanName || !cleanRegion) {
      return NextResponse.json(
        { error: "Station Name and Region are required." },
        { status: 400 }
      );
    }

    const stations = await loadStationsFromStore();

    // Check duplicate by name (case-insensitive)
    const exists = stations.some(
      (s) => s.name.toLowerCase() === cleanName.toLowerCase() && s.region.toLowerCase() === cleanRegion.toLowerCase()
    );

    if (exists) {
      return NextResponse.json(
        { error: `Station "${cleanName}" is already registered in ${cleanRegion}.` },
        { status: 409 }
      );
    }

    const regionPrefix = cleanRegion
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase();
    const regionCount = stations.filter((s) => s.region === cleanRegion).length + 1;
    const generatedCode =
      (code || "").trim().toUpperCase() ||
      `DVLA-${regionPrefix}-${String(regionCount).padStart(2, "0")}`;

    const newStation: DVLAStation = {
      id: `stn-${Date.now()}`,
      name: cleanName,
      code: generatedCode,
      region: cleanRegion,
      address: (address || "").trim() || `${cleanName}, ${cleanRegion} Region`,
      phone: (phone || "").trim() || "+233 30 274 6760",
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updatedStations = [newStation, ...stations];
    const actorName = session?.fullName || "Chief Supt. Osei Tutu";

    await saveStationsToStore(updatedStations, actorName);

    await recordAuditLog({
      applicationReference: newStation.code,
      userName: actorName,
      userRole: "DVLA Administrator",
      action: "DVLA_STATION_CREATED",
      processIdentifier: "STATION_MANAGEMENT",
      newStatus: "Active Station",
      details: `Registered new DVLA operational station "${newStation.name}" (${newStation.code}) under ${newStation.region} Region.`,
    });

    return NextResponse.json(
      {
        station: newStation,
        stations: updatedStations,
        byRegion: groupStationsByRegion(updatedStations),
        message: `DVLA station "${newStation.name}" added to ${newStation.region} Region.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create DVLA station:", error);
    return NextResponse.json(
      { error: "Failed to register DVLA station." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionUserFromRequest(req);
    if (session && session.role !== "ADMINISTRATOR") {
      return NextResponse.json(
        { error: "Only Administrators can remove DVLA stations." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Station ID is required." },
        { status: 400 }
      );
    }

    const stations = await loadStationsFromStore();
    const target = stations.find((s) => s.id === id);

    if (!target) {
      return NextResponse.json(
        { error: "DVLA station not found." },
        { status: 404 }
      );
    }

    const updatedStations = stations.filter((s) => s.id !== id);
    const actorName = session?.fullName || "Chief Supt. Osei Tutu";

    await saveStationsToStore(updatedStations, actorName);

    await recordAuditLog({
      applicationReference: target.code,
      userName: actorName,
      userRole: "DVLA Administrator",
      action: "DVLA_STATION_REMOVED",
      processIdentifier: "STATION_MANAGEMENT",
      previousStatus: "Active Station",
      newStatus: "Removed",
      details: `Removed DVLA operational station "${target.name}" (${target.code}) from ${target.region} Region.`,
    });

    return NextResponse.json({
      stations: updatedStations,
      byRegion: groupStationsByRegion(updatedStations),
      message: `Removed "${target.name}" from ${target.region} Region.`,
    });
  } catch (error) {
    console.error("Failed to delete DVLA station:", error);
    return NextResponse.json(
      { error: "Failed to remove DVLA station." },
      { status: 500 }
    );
  }
}

