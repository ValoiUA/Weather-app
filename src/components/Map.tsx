'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet.css';

type LatLng = [number, number];

interface MapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  onLocationNameResolved?: (locationName: string) => void;
  initialCenter?: LatLng;
  zoom?: number;
  className?: string;
  approximateRadius?: number; // in meters
}

const Map: React.FC<MapProps> = ({
  onLocationSelect,
  initialCenter = [0, 0],
  zoom = 2,
  className = 'h-64 w-full rounded-lg',
  onLocationNameResolved,
  approximateRadius = 10000, // 10km default radius for approximation
}) => {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const [approximateCenter, setApproximateCenter] = useState<LatLng | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memoize the default icon to prevent recreation on re-renders
  const defaultIcon = useMemo(() => L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }), []);

  // Generate a random offset within the approximate radius
  const getRandomOffset = useCallback((radius: number): [number, number] => {
    // Convert radius from meters to degrees (approximate)
    const radiusInDegrees = radius / 111000;
    
    // Generate random angle and distance
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusInDegrees;
    
    // Calculate offset
    const dLat = Math.cos(angle) * distance;
    const dLng = Math.sin(angle) * distance;
    
    return [dLat, dLng];
  }, []);

  // Function to resolve approximate location name from coordinates
  const resolveApproximateLocation = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      // Add some randomness to the coordinates for privacy
      const [offsetLat, offsetLng] = getRandomOffset(approximateRadius);
      const approxLat = lat + offsetLat;
      const approxLng = lng + offsetLng;

      // Update the approximate center for the circle
      setApproximateCenter([approxLat, approxLng]);

      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${approxLat}&lon=${approxLng}&limit=1&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const location = data[0];
        const locationName = [
          location.name,
          location.state,
          location.country
        ].filter(Boolean).join(', ');

        onLocationNameResolved?.(locationName);
        return locationName;
      }
      return null;
    } catch (error) {
      console.error('Error resolving location name:', error);
      return null;
    }
  }, [onLocationNameResolved, approximateRadius, getRandomOffset]);

  // Handle map click events
  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: defaultIcon }).addTo(mapRef.current!);
    }
    onLocationSelect(lat, lng);
    resolveApproximateLocation(lat, lng);
  }, [defaultIcon, onLocationSelect, resolveApproximateLocation]);

  // Handle marker drag events
  const handleMarkerDragEnd = useCallback(() => {
    if (markerRef.current) {
      const { lat, lng } = markerRef.current.getLatLng();
      onLocationSelect(lat, lng);
      resolveApproximateLocation(lat, lng);
    }
  }, [onLocationSelect, resolveApproximateLocation]);

  // Initialize map and markers
  useEffect(() => {
    if (mapContainer.current && !mapRef.current) {
      try {
        // Create map instance
        const map = L.map(mapContainer.current, {
          center: initialCenter,
          zoom: zoom,
          zoomControl: false,
        });

        // Add tile layer
        const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          subdomains: 'abcd'
        }).addTo(map);

        const osmTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });

        // Fallback to OSM if dark tiles fail to load
        map.on('tileerror', () => {
          if (!map.hasLayer(osmTiles)) {
            map.removeLayer(darkTiles);
            osmTiles.addTo(map);
          }
        });

        // Add controls
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

        // Add initial marker if coordinates are provided
        if (initialCenter) {
          markerRef.current = L.marker(initialCenter, { 
            icon: defaultIcon,
            draggable: true 
          }).addTo(map);
          
          markerRef.current.on('dragend', handleMarkerDragEnd);
        }

        // Add event listeners
        map.on('click', handleMapClick);

        // Store references
        mapRef.current = map;
        setIsLoading(false);

        // Cleanup function
        return () => {
          if (circleRef.current) {
            circleRef.current.remove();
            circleRef.current = null;
          }
          if (markerRef.current) {
            markerRef.current.off('dragend', handleMarkerDragEnd);
            markerRef.current.remove();
            markerRef.current = null;
          }
          if (mapRef.current) {
            mapRef.current.off('click', handleMapClick);
            mapRef.current.off('tileerror');
            mapRef.current.remove();
            mapRef.current = null;
          }
        };
      } catch (error) {
        console.error('Error initializing map:', error);
        onLocationNameResolved?.('Error initializing map');
        setIsLoading(false);
      }
    }
  }, [initialCenter, zoom, handleMapClick, handleMarkerDragEnd, defaultIcon, onLocationNameResolved]);

  // Update approximate circle when center changes
  useEffect(() => {
    if (approximateCenter && mapRef.current) {
      if (circleRef.current) {
        circleRef.current.setLatLng(approximateCenter);
      } else {
        circleRef.current = L.circle(approximateCenter, {
          radius: approximateRadius,
          fillColor: '#3388ff',
          fillOpacity: 0.2,
          color: '#3388ff',
          weight: 1
        }).addTo(mapRef.current);
      }
    }
  }, [approximateCenter, approximateRadius]);

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p>Loading map...</p>
        </div>
      )}
      <div
        ref={mapContainer}
        className={className}
        style={{ zIndex: 1 }}
        aria-label="Interactive map"
        role="application"
      />
    </div>
  );
};

Map.defaultProps = {
  initialCenter: [0, 0],
  zoom: 2,
  className: 'h-64 w-full rounded-lg',
  approximateRadius: 10000,
};

export default Map;