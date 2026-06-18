/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
// Default centre until we have a real location (Riyadh).
const DEFAULT = { lat: 24.7136, lng: 46.6753 };

/** Loads Leaflet from CDN once and resolves the global L. */
function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.L) return resolve(w.L);

    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (w.L) return resolve(w.L);
      existing.addEventListener("load", () => resolve((window as any).L));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}

/**
 * Interactive map with a draggable pin. The customer can drag the marker or tap
 * anywhere to set their exact location, or hit "Use my current location" for GPS.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [loadingGeo, setLoadingGeo] = useState(false);

  // Initialise the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const start = value ?? DEFAULT;
        const map = L.map(containerRef.current).setView([start.lat, start.lng], value ? 16 : 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        // Custom SVG pin (divIcon) — avoids Leaflet's broken default image icon.
        const pinIcon = L.divIcon({
          className: "",
          html:
            '<svg width="30" height="42" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#2563eb"/>' +
            '<circle cx="12" cy="12" r="4.5" fill="#ffffff"/></svg>',
          iconSize: [30, 42],
          iconAnchor: [15, 42],
        });

        const marker = L.marker([start.lat, start.lng], { draggable: true, icon: pinIcon }).addTo(map);
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          onChangeRef.current(ll.lat, ll.lng);
        });
        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng);
          onChangeRef.current(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
        setTimeout(() => map.invalidateSize(), 200);

        // Try to centre on the customer's GPS automatically.
        if (!value) useMyLocation();
      })
      .catch(() => {
        /* CDN failed — the manual lat/lng still works server-side */
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLoadingGeo(false);
        onChangeRef.current(lat, lng);
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
        }
      },
      () => setLoadingGeo(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-56 w-full rounded-lg border border-border overflow-hidden z-0"
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          {loadingGeo ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} strokeWidth={1.8} />}
          Use my current location
        </button>
        <span className="text-[11px] text-text-muted">Drag the pin or tap the map to adjust</span>
      </div>
    </div>
  );
}
