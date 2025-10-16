import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Compass, Camera as CameraIcon, Send } from 'lucide-react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Coords = { lat: number; lon: number };

type Place = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  distanceMeters?: number;
};

const CATEGORIES = [
  { key: 'restaurant', label: 'Restaurants' },
  { key: 'cafe', label: 'Cafes' },
  { key: 'fast_food', label: 'Fast Food' },
  { key: 'tourism', label: 'Attractions' },
  { key: 'museum', label: 'Museums' },
  { key: 'post_office', label: 'Post Offices' },
];

function haversine(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const c = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(c)));
}

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: { name?: string; amenity?: string; tourism?: string };
};

async function fetchOverpassPlaces(coords: Coords, category: string, radiusMeters = 1500): Promise<Place[]> {
  const around = `around:${radiusMeters},${coords.lat},${coords.lon}`;
  const query = `data=[out:json];(\n  node["amenity"="${category}"](${around});\n  way["amenity"="${category}"](${around});\n  node["tourism"](${around});\n);out center;`;
  const url = `https://overpass-api.de/api/interpreter?${query}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const json = await res.json();
  const elements: OverpassElement[] = Array.isArray(json.elements)
    ? (json.elements as OverpassElement[])
    : [];
  const places: Place[] = elements.map((el) => {
    const lat = typeof el.lat === 'number' ? el.lat : (el.center?.lat ?? 0);
    const lon = typeof el.lon === 'number' ? el.lon : (el.center?.lon ?? 0);
    const name = el.tags?.name || 'Unknown';
    const categoryResolved = el.tags?.amenity || el.tags?.tourism || category;
    return {
      id: String(el.id),
      name,
      category: categoryResolved,
      lat,
      lon,
      distanceMeters: lat && lon ? Math.round(haversine(coords, { lat, lon })) : undefined,
    };
  }).filter((p) => p.lat && p.lon);
  places.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  return places;
}

function getOpenAIKey(): string | undefined {
  const envKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  const stored = localStorage.getItem('openai_api_key') || undefined;
  return envKey || stored;
}

// Provider-agnostic configuration for LocalAI/OpenAI
type LLMProvider = 'openai' | 'localai';

function getLLMProvider(): LLMProvider {
  const fromEnv = (import.meta.env.VITE_LLM_PROVIDER as string | undefined)?.toLowerCase();
  const fromLocal = (localStorage.getItem('llm_provider') || '').toLowerCase();
  const val = fromLocal || fromEnv || 'openai';
  return val === 'localai' ? 'localai' : 'openai';
}

function getLLMConfig() {
  const provider = getLLMProvider();
  if (provider === 'localai') {
    const baseEnv = import.meta.env.VITE_LOCALAI_BASE_URL as string | undefined;
    const modelEnv = import.meta.env.VITE_LOCALAI_MODEL as string | undefined;
    const baseUrl = localStorage.getItem('localai_base_url') || baseEnv || 'http://localhost:8080/v1';
    const model = localStorage.getItem('localai_model') || modelEnv || 'gpt-3.5-turbo';
    const apiKey = localStorage.getItem('localai_api_key') || undefined; // often not required
    return { provider, baseUrl, model, apiKey };
  }
  const baseUrl = 'https://api.openai.com/v1';
  const model = (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || 'gpt-4o-mini';
  const apiKey = getOpenAIKey();
  return { provider, baseUrl, model, apiKey };
}

function hasLLMConfig(): boolean {
  const cfg = getLLMConfig();
  if (cfg.provider === 'localai') {
    return !!cfg.baseUrl && !!cfg.model; // key optional
  }
  return !!cfg.apiKey; // OpenAI requires api key
}

async function llmChat(prompt: string, location?: Coords, visionDescription?: string): Promise<string> {
  const cfg = getLLMConfig();
  if (!hasLLMConfig()) {
    const loc = location ? ` You are near (${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}).` : '';
    const vis = visionDescription ? ` Camera sees: ${visionDescription}.` : '';
    return `LLM not configured. ${loc}${vis} Based on nearby data, consider local restaurants, cafes, museums, and attractions.`;
  }
  const system = `You are a friendly tour guide. Use user GPS and camera context to recommend nearby dining, attractions, and identify landmarks. Be concise and helpful.`;
  const contentParts = [prompt];
  if (location) contentParts.push(`Location: ${location.lat}, ${location.lon}`);
  if (visionDescription) contentParts.push(`Vision: ${visionDescription}`);
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: contentParts.join('\n') },
    ],
  };
  const url = `${cfg.baseUrl}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`LLM error: ${res.status}`);
  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? 'No response';
  return text;
}

export function TourGuide() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I can use your location and camera to suggest nearby spots and identify landmarks. Share your location to begin.' },
  ]);
  const [input, setInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState<string>(localStorage.getItem('openai_api_key') || '');
  const [provider, setProvider] = useState<LLMProvider>(getLLMProvider());
  const [localBaseUrl, setLocalBaseUrl] = useState<string>(localStorage.getItem('localai_base_url') || (import.meta.env.VITE_LOCALAI_BASE_URL as string || 'http://localhost:8080/v1'));
  const [localModel, setLocalModel] = useState<string>(localStorage.getItem('localai_model') || (import.meta.env.VITE_LOCALAI_MODEL as string || 'gpt-3.5-turbo'));
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [loadingPOI, setLoadingPOI] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [poiCategory, setPoiCategory] = useState<string>('restaurant');
  const [cameraActive, setCameraActive] = useState(false);
  const [visionDesc, setVisionDesc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const [routingMode, setRoutingMode] = useState<'walking' | 'driving' | 'cycling'>('walking');
  const [routeSteps, setRouteSteps] = useState<{
    name: string;
    distance: number;
    duration: number;
    maneuver?: { type?: string; modifier?: string; location: [number, number] };
  }[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const nextTurnMarkerRef = useRef<L.CircleMarker | null>(null);
  const [nextTurnText, setNextTurnText] = useState<string | null>(null);
  const [nextTurnDistance, setNextTurnDistance] = useState<number | null>(null);

  const distanceToManeuver = (from: Coords, maneuverLoc: [number, number]) => {
    const lat = maneuverLoc[1];
    const lon = maneuverLoc[0];
    return haversine(from, { lat, lon });
  };

  type OSRMRouteResponse = {
    routes: Array<{
      geometry: { coordinates: [number, number][] };
      legs: Array<{
        steps: Array<{
          name: string;
          distance: number;
          duration: number;
          maneuver?: { type?: string; modifier?: string; location: [number, number] };
        }>;
      }>;
    }>;
  };

  const clearRoute = () => {
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    setRouteSteps([]);
    setNextTurnText(null);
    setNextTurnDistance(null);
    if (nextTurnMarkerRef.current) {
      nextTurnMarkerRef.current.remove();
      nextTurnMarkerRef.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const routeTo = async (place: Place) => {
    if (!coords || !mapRef.current) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Share your location to draw a route.' }]);
      return;
    }
    try {
      const url = `https://router.project-osrm.org/route/v1/${routingMode}/${coords.lon},${coords.lat};${place.lon},${place.lat}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
      const data: OSRMRouteResponse = await res.json();
      const route = data.routes?.[0];
      if (!route) throw new Error('No route found');
      const latlngs = route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
      }
      const poly = L.polyline(latlngs, { color: '#ef4444', weight: 4, opacity: 0.9 });
      poly.addTo(mapRef.current);
      routePolylineRef.current = poly;
      const bounds = poly.getBounds();
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
      const steps = route.legs?.[0]?.steps ?? [];
      setRouteSteps(steps);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Could not draw route on the map.' }]);
    }
  };

  // Start/stop live guidance based on route availability
  useEffect(() => {
    if (!coords || routeSteps.length === 0) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (watchIdRef.current !== null) return; // already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(c);
        // Auto-follow: keep map centered on user when routing
        if (mapRef.current) {
          const currentZoom = mapRef.current.getZoom();
          mapRef.current.setView([c.lat, c.lon], Math.max(currentZoom, 15));
        }
        // Compute next turn: choose nearest maneuver location
        const steps = routeSteps;
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < steps.length; i++) {
          const loc = steps[i].maneuver?.location;
          if (!loc) continue;
          const d = distanceToManeuver(c, loc);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          const s = steps[bestIdx];
          setNextTurnDistance(Math.round(bestDist));
          const action = s.maneuver?.type || 'Proceed';
          const modifier = s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : '';
          const road = s.name ? ` on ${s.name}` : '';
          setNextTurnText(`${action}${modifier}${road}`);
          // Update next turn marker
          if (mapRef.current) {
            const lat = s.maneuver?.location?.[1];
            const lon = s.maneuver?.location?.[0];
            if (typeof lat === 'number' && typeof lon === 'number') {
              if (nextTurnMarkerRef.current) {
                nextTurnMarkerRef.current.setLatLng([lat, lon]);
              } else {
                nextTurnMarkerRef.current = L.circleMarker([lat, lon], { radius: 6, color: '#f59e0b' });
                nextTurnMarkerRef.current.bindPopup('Next turn');
                nextTurnMarkerRef.current.addTo(mapRef.current);
              }
            }
          }
        } else {
          setNextTurnText(null);
          setNextTurnDistance(null);
        }
      },
      (err) => {
        // ignore errors; live guidance will be unavailable
        console.warn('watchPosition error', err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [coords, routeSteps]);

  const requestLocation = () => {
    setLocError(null);
    if (!('geolocation' in navigator)) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(c);
        setMessages((m) => [...m, { role: 'assistant', content: `Location set to (${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}).` }]);
      },
      (err) => {
        setLocError(err.message || 'Unable to get location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const loadPOIs = async () => {
    if (!coords) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Please share your location first.' }]);
      return;
    }
    try {
      setLoadingPOI(true);
      const results = await fetchOverpassPlaces(coords, poiCategory);
      setPlaces(results);
      const summary = results.slice(0, 5).map((p) => `${p.name} (${p.category}, ${p.distanceMeters ?? '?'}m)`).join(', ');
      setMessages((m) => [...m, { role: 'assistant', content: summary ? `Nearby ${poiCategory}: ${summary}` : `No nearby ${poiCategory} found.` }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Could not load nearby places right now.' }]);
    } finally {
      setLoadingPOI(false);
    }
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      const vid = videoRef.current;
      if (vid && vid.srcObject) {
        const tracks = (vid.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
        vid.srcObject = null;
      }
      setCameraActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Unable to access camera.' }]);
    }
  };

  const analyzeFrame = async () => {
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    if (!vid || !canvas) return;
    const w = vid.videoWidth || 640;
    const h = vid.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // Vision analysis relies on a multimodal LLM if configured.
    if (!hasLLMConfig()) {
      setVisionDesc('Camera frame captured. Configure LocalAI/OpenAI to enable vision analysis.');
      setMessages((m) => [...m, { role: 'assistant', content: 'Captured a frame. Vision analysis requires an image-capable LLM model.' }]);
      return;
    }
    try {
      const cfg = getLLMConfig();
      const body: {
        model: string;
        messages: (
          | { role: 'system'; content: string }
          | {
              role: 'user';
              content:
                | string
                | Array<
                    | { type: 'text'; text: string }
                    | { type: 'image_url'; image_url: { url: string } }
                  >;
            }
        )[];
      } = {
        model: cfg.model,
        messages: [
          { role: 'system', content: 'Describe the scene succinctly for a tour guide use-case. Identify notable objects or landmarks.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this photo? Focus on landmarks or notable items.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      };
      const url = `${cfg.baseUrl}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Vision error: ${res.status}`);
      const json = await res.json();
      const desc: string = json.choices?.[0]?.message?.content ?? 'No description available.';
      setVisionDesc(desc);
      setMessages((m) => [...m, { role: 'assistant', content: `Camera analysis: ${desc}` }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Vision analysis failed or model not multimodal. Try OCR or switch provider/model.' }]);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    try {
      // Fallback: simple intent detection to fetch POIs without LLM
      if (!hasLLMConfig()) {
        const lower = text.toLowerCase();
        let inferredCategory: string | undefined;
        if (/post\s*office|mail|usps/.test(lower)) inferredCategory = 'post_office';
        else if (/restaurant|eat|dine|food/.test(lower)) inferredCategory = 'restaurant';
        else if (/coffee|cafe/.test(lower)) inferredCategory = 'cafe';
        else if (/museum|gallery/.test(lower)) inferredCategory = 'museum';
        else if (/attraction|landmark|tourist/.test(lower)) inferredCategory = 'tourism';

        if (coords && inferredCategory) {
          const results = await fetchOverpassPlaces(coords, inferredCategory);
          setPlaces(results);
          const summary = results.slice(0, 5).map((p) => `${p.name} (${p.category}, ${p.distanceMeters ?? '?'}m)`).join(', ');
          setMessages((m) => [...m, { role: 'assistant', content: summary ? `Nearby ${inferredCategory.replace('_', ' ')}: ${summary}` : `No nearby ${inferredCategory.replace('_', ' ')} found.` }]);
          return;
        }
        const loc = coords ? ` You are near (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}).` : '';
        setMessages((m) => [...m, { role: 'assistant', content: `LLM not configured.${loc} Use the Nearby button or share location for recommendations.` }]);
        return;
      }
      const reply = await llmChat(text, coords ?? undefined, visionDesc ?? undefined);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Chat service is unavailable at the moment.' }]);
    }
  };

  useEffect(() => {
    // Preload location on mount to improve UX
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => void 0,
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Initialize map when we first have coords
  useEffect(() => {
    if (!coords || !mapContainerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([coords.lat, coords.lon], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    } else {
      mapRef.current.setView([coords.lat, coords.lon], 14);
    }
  }, [coords]);

  // Update markers when coords or places change
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();
    const layer = markersLayerRef.current;
    const points: L.LatLngExpression[] = [];
    if (coords) {
      const userMarker = L.circleMarker([coords.lat, coords.lon], { radius: 6, color: '#2563eb' });
      userMarker.bindPopup('You are here');
      userMarker.addTo(layer);
      points.push([coords.lat, coords.lon]);
    }
    places.forEach((p) => {
      const mk = L.circleMarker([p.lat, p.lon], { radius: 5, color: '#10b981' });
      mk.bindPopup(`${p.name} (${p.category})`);
      mk.addTo(layer);
      points.push([p.lat, p.lon]);
    });
    // Fit bounds if we have multiple points
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [places, coords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={requestLocation}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <MapPin className="w-4 h-4" /> Share Location
        </button>
        <div className="flex items-center gap-2">
          <select
            value={poiCategory}
            onChange={(e) => setPoiCategory(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={loadPOIs}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-gray-800 rounded-lg hover:bg-slate-200"
          >
            <Compass className="w-4 h-4" /> Nearby
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={routingMode}
            onChange={(e) => setRoutingMode(e.target.value as 'walking' | 'driving' | 'cycling')}
            className="border rounded-lg px-3 py-2"
          >
            <option value="walking">Walking</option>
            <option value="driving">Driving</option>
            <option value="cycling">Cycling</option>
          </select>
          <button
            onClick={clearRoute}
            disabled={routeSteps.length === 0}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${routeSteps.length > 0 ? 'bg-slate-100 text-gray-800 hover:bg-slate-200' : 'bg-slate-200 text-gray-500'}`}
          >
            Clear Route
          </button>
        </div>
        <button
          onClick={toggleCamera}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-gray-800 rounded-lg hover:bg-slate-200"
        >
          <CameraIcon className="w-4 h-4" /> {cameraActive ? 'Stop Camera' : 'Open Camera'}
        </button>
        <button
          onClick={analyzeFrame}
          disabled={!cameraActive}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cameraActive ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-gray-500'}`}
        >
          Analyze
        </button>
      </div>

      {locError && <p className="text-red-600">{locError}</p>}
      {coords && (
        <p className="text-sm text-gray-600">Location: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Chat</h3>
        <div className="mb-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as LLMProvider)}
              className="border rounded-lg px-2 py-2"
            >
              <option value="openai">OpenAI</option>
              <option value="localai">LocalAI</option>
            </select>
            <button
              onClick={() => {
                localStorage.setItem('llm_provider', provider);
                setMessages((m) => [...m, { role: 'assistant', content: `Provider set to ${provider}.` }]);
              }}
              className="px-3 py-2 bg-slate-100 text-gray-800 rounded-lg hover:bg-slate-200"
            >Save</button>
          </div>

          {provider === 'openai' ? (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="OpenAI API Key (stored locally)"
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                onClick={() => {
                  if (apiKeyInput.trim()) {
                    localStorage.setItem('openai_api_key', apiKeyInput.trim());
                    setMessages((m) => [...m, { role: 'assistant', content: 'OpenAI key saved locally.' }]);
                  } else {
                    localStorage.removeItem('openai_api_key');
                    setMessages((m) => [...m, { role: 'assistant', content: 'OpenAI key cleared.' }]);
                  }
                }}
                className="px-3 py-2 bg-slate-100 text-gray-800 rounded-lg hover:bg-slate-200"
              >Save</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <input
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                placeholder="LocalAI Base URL (e.g. http://localhost:8080/v1)"
                className="border rounded-lg px-3 py-2"
              />
              <input
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                placeholder="LocalAI Model (e.g. gpt-3.5-turbo)"
                className="border rounded-lg px-3 py-2"
              />
              <button
                onClick={() => {
                  localStorage.setItem('localai_base_url', localBaseUrl.trim());
                  localStorage.setItem('localai_model', localModel.trim());
                  setMessages((m) => [...m, { role: 'assistant', content: 'LocalAI settings saved.' }]);
                }}
                className="px-3 py-2 bg-slate-100 text-gray-800 rounded-lg hover:bg-slate-200"
              >Save</button>
            </div>
          )}
        </div>
        <div className="h-72 overflow-y-auto border rounded-lg p-3 bg-white mb-3">
          {messages.map((m, i) => (
            <div key={i} className={`mb-3 ${m.role === 'assistant' ? 'text-blue-700' : 'text-gray-800'}`}>
              <span className="font-medium">{m.role === 'assistant' ? 'Guide' : 'You'}:</span> {m.content}
            </div>
          ))}
        </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for recommendations or details..."
              className="flex-1 border rounded-lg px-3 py-2"
            />
            <button
              onClick={sendMessage}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Nearby Places</h3>
          {loadingPOI && <p className="text-gray-600">Loading nearby places...</p>}
          {!loadingPOI && (
            <ul className="space-y-2">
              {places.slice(0, 20).map((p) => (
                <li key={p.id} className="bg-white border rounded-lg p-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-gray-600">{p.category} · {p.distanceMeters ? `${p.distanceMeters}m` : 'distance unknown'}</div>
                  <div className="mt-2 flex gap-3 text-sm">
                    <button
                      className="text-emerald-700 hover:underline"
                      onClick={() => routeTo(p)}
                    >Route on map</button>
                    <a
                      className="text-blue-600 hover:underline"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}${coords ? `&origin=${coords.lat},${coords.lon}` : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >Directions (Google)</a>
                    <a
                      className="text-blue-600 hover:underline"
                      href={`http://maps.apple.com/?daddr=${p.lat},${p.lon}${coords ? `&saddr=${coords.lat},${coords.lon}` : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >Directions (Apple)</a>
                  </div>
                </li>
              ))}
              {places.length === 0 && <li className="text-gray-600">No places loaded yet. Choose a category and click Nearby.</li>}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Map</h3>
        <div ref={mapContainerRef} className="w-full h-80 rounded-lg overflow-hidden border" />
        {(nextTurnText || nextTurnDistance !== null) && (
          <div className="mt-3 text-sm text-gray-800">
            <span className="font-medium">Next turn:</span> {nextTurnText ?? 'calculating...'}
            {nextTurnDistance !== null && ` · ${nextTurnDistance}m`}
          </div>
        )}
        {routeSteps.length > 0 && (
          <div className="mt-3">
            <h4 className="font-medium mb-1">Route steps</h4>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              {routeSteps.map((s, idx) => (
                <li key={idx}>
                  {(s.maneuver?.type ? s.maneuver.type : 'Proceed')}{s.name ? ` on ${s.name}` : ''} · {Math.round(s.distance)}m
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Camera</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-64 object-cover" muted playsInline />
          </div>
          <div>
            <canvas ref={canvasRef} className="w-full h-64 bg-white border rounded-lg" />
            {visionDesc && (
              <p className="mt-2 text-gray-700"><span className="font-semibold">Vision:</span> {visionDesc}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}