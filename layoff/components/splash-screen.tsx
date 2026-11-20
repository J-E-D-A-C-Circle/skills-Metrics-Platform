"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"bouncing" | "fadeout">("bouncing");

  useEffect(() => {
    // After 2.4s of bouncing, start fade-out
    const fadeTimer = setTimeout(() => setPhase("fadeout"), 2400);
    // After fade completes (300ms) notify parent
    const doneTimer = setTimeout(() => onDone(), 2700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#006837] transition-opacity duration-300 ${
        phase === "fadeout" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Bouncing logo */}
      <div
        className={`relative transition-transform ${
          phase === "bouncing" ? "animate-splash-bounce" : ""
        }`}
        style={{ width: 160, height: 160 }}
      >
        <Image
          src="/oop.png"
          alt="DVLA Ghana"
          fill
          className="object-contain drop-shadow-2xl"
          priority
        />
      </div>

      {/* Label under logo */}
      <p className="mt-6 text-white/80 text-sm font-semibold tracking-widest uppercase">
        Vehicle Layoff Portal
      </p>
      <p className="mt-1 text-white/50 text-xs tracking-wide">
        Driver &amp; Vehicle Licensing Authority · Ghana
      </p>
    </div>
  );
}
