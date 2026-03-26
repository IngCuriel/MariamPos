/**
 * Geocodificación pública (OpenStreetMap Nominatim) para centrar mapas con marcador claro.
 * Uso moderado; respeta la política de Nominatim (sin spam).
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export async function geocodeAddressForDelivery(address: string): Promise<GeoPoint | null> {
  const q = address.trim();
  if (!q) return null;

  const params = new URLSearchParams({
    format: 'json',
    q,
    limit: '1',
    countrycodes: 'mx',
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'es-MX,es',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number.parseFloat(data[0].lat ?? '');
    const lng = Number.parseFloat(data[0].lon ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Mapa embebido OSM con marcador fijo en las coordenadas del cliente. */
export function openStreetMapEmbedUrl(lat: number, lng: number): string {
  const d = 0.007;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const markerPair = `${lat},${lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(markerPair)}`;
}

export function formatCoordsForDisplay(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
