import React, { useEffect, useState } from 'react';
import { DeviceStatus } from '@/services/fleetApi';

interface LeafletMapProps {
  vehicles: DeviceStatus[];
}

export function LeafletMap({ vehicles }: LeafletMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map...</div>;
  }

  const leaflet = require('leaflet');
  const reactLeaflet = require('react-leaflet');
  const { MapContainer, TileLayer, Marker, Popup } = reactLeaflet;

  delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
  leaflet.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });

  const formatCoordinate = (coord: number): number => {
    return coord / 1000000;
  };

  const formatSpeed = (speed: number): string => {
    return (speed / 10).toFixed(1);
  };

  const centerLat = vehicles.length > 0
    ? vehicles.reduce((sum, v) => sum + formatCoordinate(v.lat), 0) / vehicles.length
    : 22.5;
  const centerLng = vehicles.length > 0
    ? vehicles.reduce((sum, v) => sum + formatCoordinate(v.lng), 0) / vehicles.length
    : 114.0;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
      />
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {vehicles.map((vehicle, index) => {
          const lat = formatCoordinate(vehicle.lat);
          const lng = formatCoordinate(vehicle.lng);
          const isOnline = vehicle.ol === 1;

          return (
            <Marker key={`${vehicle.id}-${index}`} position={[lat, lng]}>
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <strong style={{ fontSize: 16, marginBottom: 8, display: 'block' }}>
                    {vehicle.vid || vehicle.id}
                  </strong>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Device ID:</strong> {vehicle.id}
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Status:</strong>{' '}
                    <span style={{ color: isOnline ? '#10b981' : '#ef4444' }}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Speed:</strong> {formatSpeed(vehicle.sp)} km/h
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Position:</strong> {lat.toFixed(6)}, {lng.toFixed(6)}
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Last Update:</strong> {vehicle.gt}
                  </div>
                  {vehicle.dn && (
                    <div style={{ marginBottom: 4 }}>
                      <strong>Driver:</strong> {vehicle.dn}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </>
  );
}
