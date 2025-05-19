'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/leaflet.css';

type LatLng = [number, number];

interface MapWithApproximateLocationProps {
  onLocationSelect: (lat: number, lng: number) => void;
  onLocationNameResolved?: (locationName: string) => void;
  initialCenter?: LatLng;
  zoom?: number;
  className?: string;
  approximateRadius?: number; // in meters
}

const MapWithApproximateLocation: React.FC<MapWithApproximateLocationProps> = ({
  onLocationSelect,
  initialCenter = [0, 0],
  zoom = 2,
  className = 'h-64 w-full rounded-lg',
  onLocationNameResolved,
  approximateRadius = 10000, // 10km default radius for approximation
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const [approximateCenter, setApproximateCenter] = useState<LatLng | null>(null);

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
  const resolveApproximateLocation = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      // Add some randomness to the coordinates for privacy
      const [offsetLat, offsetLng] = getRandomOffset(approximateRadius);
      const approxLat = lat + offsetLat;
      const approxLng = lng + offsetLng;

      // Update the approximate center for the circle
      setApproximateCenter([approxLat, approxLng]);

      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${approxLat}&lon=${approxLng}&limit=1&appid=710a8376497edd9944e2f9a9f72d0382`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const location = data[0];
        const locationName = [
          location.name || '',
          location.state || '',
          location.country || ''
        ].filter(Boolean).join(', ');
        
        return locationName;
      }
      return 'Unknown location';
    } catch (error) {
      console.error('Error resolving location:', error);
      return 'Unknown location';
    }
  }, [approximateRadius, getRandomOffset]);

  // Initialize the map
  useEffect(() => {
    if (mapContainer.current && !mapRef.current) {
      // Create map instance
      const map = L.map(mapContainer.current, {
        center: initialCenter,
        zoom,
        zoomControl: false,
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Add click handler with approximate location
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        
        // Update marker position
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: defaultIcon }).addTo(map);
        }

        // Add or update circle of uncertainty
        if (circleRef.current) {
          circleRef.current.setLatLng([lat, lng]);
        } else {
          circleRef.current = L.circle([lat, lng], {
            radius: approximateRadius,
            color: '#3388ff',
            fillColor: '#3388ff',
            fillOpacity: 0.2
          }).addTo(map);
        }

        // Call the callback with the selected coordinates
        onLocationSelect(lat, lng);

        // Resolve approximate location name if callback provided
        if (onLocationNameResolved) {
          const locationName = await resolveApproximateLocation(lat, lng);
          onLocationNameResolved(locationName);
        }
      });

      // Store map instance
      mapRef.current = map;
    }


    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initialCenter, zoom, onLocationSelect, onLocationNameResolved, defaultIcon, approximateRadius, resolveApproximateLocation]);

  // Update map when initialCenter changes
  useEffect(() => {
    if (mapRef.current && initialCenter && initialCenter[0] !== 0 && initialCenter[1] !== 0) {
      mapRef.current.setView(initialCenter, mapRef.current.getZoom());
      
      // Update marker position
      if (markerRef.current) {
        markerRef.current.setLatLng(initialCenter);
      } else if (mapRef.current) {
        markerRef.current = L.marker(initialCenter, { icon: defaultIcon }).addTo(mapRef.current);
      }

      // Add or update circle of uncertainty
      if (circleRef.current) {
        circleRef.current.setLatLng(initialCenter);
      } else if (mapRef.current) {
        circleRef.current = L.circle(initialCenter, {
          radius: approximateRadius,
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.2
        }).addTo(mapRef.current);
      }

      // Resolve approximate location name if callback provided
      if (onLocationNameResolved) {
        resolveApproximateLocation(initialCenter[0], initialCenter[1]).then(locationName => {
          onLocationNameResolved(locationName);
        });
      }
    }
  }, [initialCenter, onLocationNameResolved, defaultIcon, approximateRadius, resolveApproximateLocation]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={mapContainer} className={className} />;
};

export default MapWithApproximateLocation;
