import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  MapPin,
  AlertTriangle,
  Layers,
  Navigation,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  X,
  Compass,
} from 'lucide-react';

// Fix leaflet default icon URLs in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GeofenceMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  radius: number; // in metres
  onLocationChange: (lat: number, lng: number) => void;
  instituteName?: string;
  readOnly?: boolean;
}

interface SearchResultItem {
  display_name: string;
  lat: string;
  lon: string;
}

export const GeofenceMapPicker: React.FC<GeofenceMapPickerProps> = ({
  latitude,
  longitude,
  radius,
  onLocationChange,
  instituteName = 'Course Centre',
  readOnly = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Tile layer instances (Zero API key required)
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const osmLayerRef = useRef<L.TileLayer | null>(null);

  const [mapType, setMapType] = useState<'street' | 'satellite' | 'osm'>('street');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [locatingCurrent, setLocatingCurrent] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);
  const [locationWarningMsg, setLocationWarningMsg] = useState<string | null>(null);
  const [pendingCoarseLocation, setPendingCoarseLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Fallback coords: Central Tamil Nadu / Chennai
  const defaultLat = latitude ?? 13.0827;
  const defaultLng = longitude ?? 80.2707;

  // Initialize Map and Layers
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // initialize only once

    try {
      // 1. Google Streets Layer: 100% free, crisp, familiar, no API key needed
      const streetLayer = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        {
          attribution: '&copy; Google Maps',
          maxZoom: 20,
        }
      );

      // 2. Google Hybrid Satellite Layer: Real aerial photography with road and place labels overlaid
      const satelliteLayer = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        {
          attribution: '&copy; Google Maps',
          maxZoom: 20,
        }
      );

      // 3. OpenStreetMap Standard (Clean fallback)
      const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      });

      streetLayerRef.current = streetLayer;
      satelliteLayerRef.current = satelliteLayer;
      osmLayerRef.current = osmLayer;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: latitude && longitude ? 17 : 13,
        zoomControl: true,
        layers: [streetLayer], // Default to Google Streets
      });

      // Draggable center pin
      const marker = L.marker([defaultLat, defaultLng], {
        draggable: !readOnly,
        title: instituteName,
      }).addTo(map);

      marker.bindPopup(`<b>${instituteName}</b><br/>Approved Geofence Center`).openPopup();

      // Circular geofence boundary overlay (200m)
      const circle = L.circle([defaultLat, defaultLng], {
        radius: radius || 200,
        color: '#4E342E',
        weight: 2,
        fillColor: '#8D6E63',
        fillOpacity: 0.25,
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;
      mapInstanceRef.current = map;

      // Handle marker drag
      if (!readOnly) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          circle.setLatLng(pos);
          onLocationChange(pos.lat, pos.lng);
        });

        // Click anywhere on map to place marker
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          circle.setLatLng([lat, lng]);
          onLocationChange(lat, lng);
        });
      }

      // Invalidate size after rendering to avoid tile clipping
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    } catch (err: any) {
      console.error('[GeofenceMapPicker] Leaflet initialization error:', err);
      setMapError('Failed to load map. Please check your internet connection or reload.');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle layer switching (Street vs Satellite vs OSM)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const street = streetLayerRef.current;
    const satellite = satelliteLayerRef.current;
    const osm = osmLayerRef.current;

    if (!street || !satellite || !osm) return;

    if (map.hasLayer(street)) map.removeLayer(street);
    if (map.hasLayer(satellite)) map.removeLayer(satellite);
    if (map.hasLayer(osm)) map.removeLayer(osm);

    if (mapType === 'satellite') {
      map.addLayer(satellite);
    } else if (mapType === 'street') {
      map.addLayer(street);
    } else {
      map.addLayer(osm);
    }
  }, [mapType]);

  // Sync radius changes with circle overlay
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  // Sync coordinate changes from props
  useEffect(() => {
    if (latitude != null && longitude != null && markerRef.current && circleRef.current && mapInstanceRef.current) {
      const curLatLng = markerRef.current.getLatLng();
      if (Math.abs(curLatLng.lat - latitude) > 0.00001 || Math.abs(curLatLng.lng - longitude) > 0.00001) {
        const newLatLng = new L.LatLng(latitude, longitude);
        markerRef.current.setLatLng(newLatLng);
        circleRef.current.setLatLng(newLatLng);
        mapInstanceRef.current.panTo(newLatLng);
      }
    }
  }, [latitude, longitude]);

  // Apply specific coordinates to marker, circle, map, and callback
  const applyCoordinates = (lat: number, lng: number, zoomLevel = 18, sourceLabel = 'Selected Location') => {
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      const latLng = new L.LatLng(lat, lng);
      markerRef.current.setLatLng(latLng);
      circleRef.current.setLatLng(latLng);
      markerRef.current.bindPopup(`<b>${instituteName}</b><br/>${sourceLabel}`).openPopup();
      mapInstanceRef.current.flyTo(latLng, zoomLevel, { duration: 1.2 });
      onLocationChange(lat, lng);
    }
  };

  // Handle Search: supports direct Lat,Lng coordinates, Google Maps links, and text queries
  const handleSearch = async (e?: React.FormEvent | React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    const trimmed = searchQuery.trim();

    // 1. Check if user entered direct coordinates e.g. "10.9602, 79.3844" or "10.9602 79.3844"
    const coordRegex = /([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)/;
    const match = trimmed.match(coordRegex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        applyCoordinates(lat, lng, 18, 'Direct Coordinates');
        setLocationSuccessMsg(`Centered at coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}. Click "Save Configuration" to confirm.`);
        setLocationWarningMsg(null);
        setSearching(false);
        return;
      }
    }

    // 2. Check if user pasted a Google Maps URL containing @lat,lng or q=lat,lng
    const gmapsMatch =
      trimmed.match(/@([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/) ||
      trimmed.match(/[?&]q=([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/);
    if (gmapsMatch) {
      const lat = parseFloat(gmapsMatch[1]);
      const lng = parseFloat(gmapsMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        applyCoordinates(lat, lng, 18, 'Google Maps Location');
        setLocationSuccessMsg(`Loaded Google Maps location: ${lat.toFixed(6)}, ${lng.toFixed(6)}. Click "Save Configuration" to confirm.`);
        setLocationWarningMsg(null);
        setSearching(false);
        return;
      }
    }

    // 3. Fallback to OpenStreetMap Nominatim geocoding (restricted to India)
    const queryNominatim = async (queryText: string): Promise<SearchResultItem[]> => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(queryText)}`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    };

    try {
      let data = await queryNominatim(trimmed);
      let matchedLocality = '';

      // If no exact match (common with Indian door numbers / plot numbers),
      // progressively try broader parts of the address
      if (!data || data.length === 0) {
        const candidates: string[] = [];

        // Check if there is an Indian postal code or Chennai area suffix like "chennai-19" -> "600019"
        const pincodeMatch = trimmed.match(/\b(\d{6})\b/) || trimmed.match(/chennai\s*-\s*(\d{1,2})\b/i);
        if (pincodeMatch) {
          const pin = pincodeMatch[1].length <= 2 ? `6000${pincodeMatch[1].padStart(2, '0')}` : pincodeMatch[1];
          candidates.push(pin);
        }

        // Split by comma
        const parts = trimmed
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);

        if (parts.length > 1) {
          // Drop door number prefixes (e.g. "no 9/44", "plot 12", "flat 3b", "#14", "door no 5")
          const nonDoorParts = parts.filter(
            (p) => !/^(no\.?|plot|door\s*no\.?|flat|d\.?\s*no\.?|#)\s*[\d/A-Za-z-]+/i.test(p)
          );
          if (nonDoorParts.length > 0 && nonDoorParts.length < parts.length) {
            candidates.push(nonDoorParts.join(', '));
          }

          // Try the last 2 parts (usually locality/town + city, e.g. "thiruvottiyur, chennai")
          const lastTwo = parts
            .slice(-2)
            .map((p) => p.replace(/-\d+$/, ''))
            .join(', ');
          candidates.push(lastTwo);

          // Try just the area name + city
          if (parts.length >= 3) {
            const area = parts[parts.length - 2].replace(/-\d+$/, '');
            const city = parts[parts.length - 1].replace(/-\d+$/, '');
            candidates.push(`${area}, ${city}`);
            candidates.push(area);
          }
        }

        for (const candidate of candidates) {
          if (!candidate || candidate.toLowerCase() === trimmed.toLowerCase()) continue;
          const res = await queryNominatim(candidate);
          if (res && res.length > 0) {
            data = res;
            matchedLocality = candidate;
            break;
          }
        }
      }

      if (data && data.length > 0) {
        if (data.length === 1) {
          const item = data[0];
          const newLat = parseFloat(item.lat);
          const newLng = parseFloat(item.lon);
          applyCoordinates(newLat, newLng, 17, item.display_name.split(',')[0]);
          if (matchedLocality) {
            setLocationSuccessMsg(
              `Centered at: ${item.display_name.split(',').slice(0, 3).join(', ')} (matched "${matchedLocality}"). Note: exact door numbers are not indexed in OpenStreetMap, so please drag the pin to your building or paste Google Maps coordinates.`
            );
          } else {
            setLocationSuccessMsg(`Found: ${item.display_name.split(',').slice(0, 3).join(',')}`);
          }
          setLocationWarningMsg(null);
        } else {
          // Multiple results: show selection dropdown
          setSearchResults(data);
          if (matchedLocality) {
            setLocationSuccessMsg(`Showing matches for: "${matchedLocality}"`);
          }
        }
      } else {
        setSearchError('Location not found. Try searching by town/city name, postal PIN code, or paste exact coordinates (e.g. 10.9602, 79.3844).');
      }
    } catch (err: any) {
      console.error('[GeofenceMapPicker] Search error:', err);
      setSearchError('Search failed. Please try again or paste direct coordinates from Google Maps.');
    } finally {
      setSearching(false);
    }
  };

  // Allow applying coarse PC location if user insists
  const handleApplyCoarseLocation = () => {
    if (!pendingCoarseLocation) return;
    const { lat, lng, accuracy } = pendingCoarseLocation;
    applyCoordinates(lat, lng, 16, `PC Estimated Location (±${Math.round(accuracy / 1000)}km)`);
    setLocationSuccessMsg(
      `Locked to PC estimated position: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy / 1000)}km). Click "Save Configuration" to confirm.`
    );
    setLocationWarningMsg(null);
    setPendingCoarseLocation(null);
  };

  // Select a result from dropdown
  const handleSelectResult = (item: SearchResultItem) => {
    const newLat = parseFloat(item.lat);
    const newLng = parseFloat(item.lon);
    applyCoordinates(newLat, newLng, 17, item.display_name.split(',')[0]);
    setLocationSuccessMsg(`Centered at: ${item.display_name.split(',').slice(0, 3).join(',')}`);
    setLocationWarningMsg(null);
    setSearchResults([]);
    setSearchQuery(item.display_name.split(',').slice(0, 2).join(', '));
  };

  // Locate current position using device GPS
  const handleUseCurrentPosition = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser or device.');
      return;
    }

    setLocatingCurrent(true);
    setSearchError(null);
    setLocationSuccessMsg(null);
    setLocationWarningMsg(null);
    setSearchResults([]);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingCurrent(false);
        const { latitude: curLat, longitude: curLng, accuracy } = pos.coords;

        // Check if accuracy is coarse (e.g. > 1000m like ±50,000m on desktop PC without hardware GPS)
        if (accuracy != null && accuracy > 1000) {
          // Desktop computers have no GPS antenna and rely on ISP telecom towers 50km away!
          setLocationWarningMsg(
            `Inaccurate PC Location Detected (±${Math.round(accuracy / 1000)} km margin of error): Your laptop does not have a hardware satellite GPS chip, so Windows reported an estimate from your internet provider's regional tower (${curLat.toFixed(4)}, ${curLng.toFixed(4)}), which is ~${Math.round(accuracy / 1000)} km away from your actual academy. To set the exact building, please search your town name or paste coordinates from Google Maps below.`
          );

          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([curLat, curLng], 12, { duration: 1.2 });
          }
          return;
        }

        // True GPS or high-accuracy location (accuracy <= 1000m, e.g. on mobile phone ±5m to ±25m)
        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          const latLng = new L.LatLng(curLat, curLng);
          markerRef.current.setLatLng(latLng);
          circleRef.current.setLatLng(latLng);

          const accText = accuracy ? `Accuracy: ±${Math.round(accuracy)}m` : '';
          markerRef.current
            .bindPopup(`<b>${instituteName}</b><br/>Locked to Your Current Location (${accText})`)
            .openPopup();

          mapInstanceRef.current.flyTo(latLng, 18, { duration: 1.2 });
          onLocationChange(curLat, curLng);

          setLocationSuccessMsg(
            `GPS location locked: ${curLat.toFixed(6)}, ${curLng.toFixed(6)} (${accText}). Click "Save Configuration" to confirm.`
          );
        }
      },
      (err) => {
        setLocatingCurrent(false);
        console.warn('[GeofenceMapPicker] Geolocation error:', err);
        if (err.code === 1) {
          setSearchError(
            'Location access permission was denied. Please click the padlock or site settings icon in your browser address bar, set Location to "Allow", and try again.'
          );
        } else if (err.code === 2) {
          setSearchError(
            'Unable to determine physical location. Please check that Windows Location Services are turned ON and device has internet connectivity.'
          );
        } else if (err.code === 3) {
          setSearchError(
            'GPS request timed out. Please click "Use My Current Location" again or paste your Google Maps coordinates.'
          );
        } else {
          setSearchError(`Failed to get location: ${err.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  };

  const handleCopyCoordinates = () => {
    if (latitude != null && longitude != null) {
      navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search & Actions Bar */}
      {!readOnly && (
        <div className="relative space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input Box */}
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSearch();
                    }
                  }}
                  placeholder="Search town, street, area, PIN code, or paste coordinates (e.g. 10.9602, 79.3844)..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={searching}
                className="px-4 py-2.5 text-xs font-semibold bg-[#8D6E63] text-white rounded-xl hover:bg-[#006FFF] disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Search</span>
              </button>
            </div>

            {/* Current Location Button */}
            <button
              type="button"
              onClick={handleUseCurrentPosition}
              disabled={locatingCurrent}
              className="px-4 py-2.5 text-xs font-bold bg-[#006FFF] text-white rounded-xl hover:bg-[#0058D4] disabled:opacity-60 transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 border border-[#3E2723] active:scale-[0.98]"
              title="Lock geofence using your device's live position (Most accurate on mobile phones with GPS)"
            >
              {locatingCurrent ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Acquiring GPS...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 text-amber-300" />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>
          </div>

          {/* Autocomplete / Multi-match search dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 sm:right-48 z-[2000] mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-xl overflow-hidden divide-y divide-[#EFEBE9]">
              <div className="px-3 py-1.5 bg-[#FAF8F5] text-[11px] font-bold text-[#94A3B8] flex justify-between items-center">
                <span>Select matching locality:</span>
                <button
                  type="button"
                  onClick={() => setSearchResults([])}
                  className="text-stone-400 hover:text-stone-700 text-xs"
                >
                  Close
                </button>
              </div>
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-stone-50 transition-colors flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#94A3B8] mt-0.5 shrink-0" />
                  <span className="text-[#0F172A] line-clamp-1">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications: Success */}
      {locationSuccessMsg && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{locationSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocationSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold text-xs ml-3 shrink-0 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Notifications: Inaccurate PC Geolocation Warning */}
      {locationWarningMsg && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2 animate-fade-in shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1.5">
                <span className="font-bold text-amber-950 text-xs block leading-relaxed">
                  {locationWarningMsg}
                </span>
                <div className="text-[11px] text-amber-900 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200 space-y-1">
                  <div className="font-semibold text-amber-950">How to get your 100% exact location:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-900">
                    <li>Type your actual town name in the search bar above (e.g. <em>"Kumbakonam"</em>, <em>"Thanjavur"</em>, <em>"Cuddalore"</em>).</li>
                    <li>Or open Google Maps, find your course centre building, right-click to copy coordinates (e.g. <code>10.7867, 79.1378</code>), and paste them into the box.</li>
                    <li>Or switch the map to <strong>"🛰️ Satellite"</strong> and drag the brown pin directly onto your building.</li>
                  </ul>
                </div>
                {pendingCoarseLocation && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyCoarseLocation}
                      className="px-3 py-1.5 text-xs font-bold bg-[#006FFF] hover:bg-[#0058D4] text-amber-300 rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      Use Estimated Location Anyway ({pendingCoarseLocation.lat.toFixed(4)}, {pendingCoarseLocation.lng.toFixed(4)})
                    </button>
                    <span className="text-[11px] text-amber-800 italic">
                      (Accepts laptop's detected location)
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLocationWarningMsg(null);
                setPendingCoarseLocation(null);
              }}
              className="text-amber-800 hover:text-amber-950 font-bold text-xs shrink-0 underline ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Notifications: Error */}
      {searchError && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{searchError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSearchError(null)}
            className="text-red-700 hover:text-red-950 font-bold text-xs ml-3 shrink-0 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Map Container with Layer Switcher */}
      <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-md bg-[#F1F5F9]">
        {mapError ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#64748B]">
            <AlertTriangle className="w-8 h-8 text-amber-600 mb-2" />
            <p className="text-sm font-semibold">{mapError}</p>
          </div>
        ) : (
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        )}

        {/* Layer Switcher (Top-Right on Map): Google Streets, Google Satellite, OSM */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-[#E2E8F0] text-xs">
          <button
            type="button"
            onClick={() => setMapType('street')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              mapType === 'street'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
            title="Google Street Map with full roads, shops, schools, and landmarks (No API key needed)"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>🗺️ Streets</span>
          </button>

          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              mapType === 'satellite'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
            title="Google Satellite Hybrid view with real building roofs and road labels"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>🛰️ Satellite</span>
          </button>

          <button
            type="button"
            onClick={() => setMapType('osm')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              mapType === 'osm'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
            title="OpenStreetMap standard view"
          >
            <span>🌐 OSM</span>
          </button>
        </div>

        {/* Floating Coordinates & Copy Badge (Bottom-Left) */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-[#E2E8F0] text-[11px] text-[#006FFF] flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="font-mono font-semibold">
              {latitude != null && longitude != null
                ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                : 'Not Set'}
            </span>
          </div>

          <span className="text-[#94A3B8] font-bold">| Radius: {radius}m</span>

          {latitude != null && longitude != null && (
            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="p-1 rounded-md hover:bg-stone-100 text-stone-600 transition-colors flex items-center gap-1"
              title="Copy Coordinates to Clipboard"
            >
              {copiedCoords ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span className="text-[10px] font-bold">{copiedCoords ? 'Copied' : 'Copy'}</span>
            </button>
          )}

          {latitude != null && longitude != null && (
            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-md hover:bg-stone-100 text-blue-700 transition-colors flex items-center gap-1 font-semibold"
              title="Verify location in Google Maps"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="text-[10px]">Open Google Maps ↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Map Guidance Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#64748B] gap-1">
        <p className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
          <span>
            Drag the brown pin or click anywhere on the map to set your institute building. The circular boundary indicates the {radius}m attendance zone.
          </span>
        </p>
        <span className="text-stone-500 italic">
          Switch to <strong>🛰️ Satellite</strong> to visually see building roofs and gates.
        </span>
      </div>
    </div>
  );
};
