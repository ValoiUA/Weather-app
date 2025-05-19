'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import the Map component with no SSR
const MapWithNoSSR = dynamic<{
  onLocationSelect: (lat: number, lng: number) => void;
  onLocationNameResolved?: (locationName: string) => void;
  initialCenter?: [number, number];
  zoom?: number;
  className?: string;
}>(() => import('@/components/Map').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-800 rounded-lg flex items-center justify-center">
      Loading map...
    </div>
  ),
});

type RecentSearch = {
  id: string;
  name: string;
  timestamp: number;
};

export default function Home() {
  const [city, setCity] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showMap, setShowMap] = useState(false);
  type MapCoords = { lat: number; lng: number };
  const [mapCoords, setMapCoords] = useState<MapCoords | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const router = useRouter();

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSearches = localStorage.getItem('recentSearches');
      if (savedSearches) {
        try {
          setRecentSearches(JSON.parse(savedSearches));
        } catch (e) {
          console.error('Error parsing saved searches:', e);
        }
      }
    }
  }, []);

  // Save to recent searches
  const saveToRecentSearches = (name: string) => {
    const newSearch = {
      id: Date.now().toString(),
      name,
      timestamp: Date.now(),
    };

    const updatedSearches = [
      newSearch,
      ...recentSearches.filter((search) => search.name.toLowerCase() !== name.toLowerCase())
    ].slice(0, 5); // Keep only 5 most recent

    setRecentSearches(updatedSearches);
    if (typeof window !== 'undefined') {
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim()) {
      saveToRecentSearches(city);
      router.push(`/weather/${encodeURIComponent(city)}`);
    }
  };

  // This function is now handled within the Map component

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700/50 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="absolute -inset-1 bg-blue-500/30 rounded-full blur opacity-75"></div>
            <div className="relative bg-gradient-to-r from-blue-500 to-cyan-400 text-4xl font-bold bg-clip-text text-transparent">
              Weather App
            </div>
          </div>
          <p className="text-gray-300 mt-2">Discover the weather in any city worldwide</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl opacity-75 group-hover:opacity-100 blur transition duration-300"></div>
            <div className="relative flex space-x-2">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter city name"
                className="flex-1 px-6 py-4 rounded-xl text-lg bg-gray-900/80 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 placeholder-gray-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="px-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors duration-300 flex items-center justify-center"
                title="Pick location from map"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>

          {showMap && (
            <div className="mt-4 bg-gray-900/80 p-4 rounded-xl border border-gray-700/50">
              <div className="h-96 w-full rounded-lg overflow-hidden relative">
                {isMapLoading && (
                  <div className="absolute inset-0 bg-gray-900/80 z-10 flex items-center justify-center">
                    <div className="animate-pulse text-white">Loading map...</div>
                  </div>
                )}
                {mapError && (
                  <div className="absolute inset-0 bg-red-900/80 z-10 flex items-center justify-center p-4">
                    <div className="text-white text-center">
                      <p className="font-bold">Map Error</p>
                      <p className="text-sm opacity-80">{mapError}</p>
                      <button 
                        onClick={() => setMapError(null)}
                        className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
                <MapWithNoSSR 
                  onLocationSelect={(lat: number, lng: number) => {
                    setMapCoords({ lat, lng });
                    setIsMapLoading(true);
                    setMapError(null);
                  }}
                  onLocationNameResolved={(locationName) => {
                    setSelectedLocation(locationName);
                    saveToRecentSearches(locationName);
                    setIsMapLoading(false);
                  }}
                  initialCenter={mapCoords ? [mapCoords.lat, mapCoords.lng] : undefined}
                  zoom={mapCoords ? 14 : 2}
                  className="h-full w-full rounded-lg"
                />
              </div>
              <p className="text-sm text-gray-400 text-center mt-2">
                Click on the map to select a location
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            Get Weather
          </button>
        </form>

        {recentSearches.length > 0 && (
          <div className="mt-8">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Recently searched</h3>
            <div className="space-y-2">
              {recentSearches.map((search) => (
                <button
                  key={search.id}
                  onClick={() => {
                    setCity(search.name);
                    router.push(`/weather/${encodeURIComponent(search.name)}`);
                  }}
                  className="w-full text-left p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors duration-200 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-gray-400">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span className="text-white">{search.name}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(search.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            <span className="text-gray-500">Try:</span>{' '}
            <button onClick={() => setCity('London')} className="hover:text-blue-400 transition-colors">London</button>,{' '}
            <button onClick={() => setCity('New York')} className="hover:text-blue-400 transition-colors">New York</button>,{' '}
            <button onClick={() => setCity('Tokyo')} className="hover:text-blue-400 transition-colors">Tokyo</button>
          </p>
        </div>
      </div>
    </div>
  );
}
