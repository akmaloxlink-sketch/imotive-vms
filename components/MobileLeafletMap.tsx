import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { DeviceStatus } from '@/services/fleetApi';

interface MobileLeafletMapProps {
  vehicles: DeviceStatus[];
  centerOn?: DeviceStatus | null;
}

export function MobileLeafletMap({ vehicles, centerOn }: MobileLeafletMapProps) {
  const webviewRef = useRef<WebView>(null);

  const formatCoordinate = (coord: number): number => {
    return coord / 1000000;
  };

  const getMapHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
          <style>
            html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
            #map { width: 100%; height: 100vh; position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
            .leaflet-control-attribution { display: none !important; }
            
            /* Modern Marker Styles */
            .marker-container {
              position: relative;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .marker-pulse {
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: rgba(16, 185, 129, 0.4);
              animation: pulse 2s infinite;
              z-index: 1;
            }

            .marker-core {
              width: 28px;
              height: 28px;
              border-radius: 50%;
              background: white;
              box-shadow: 0 2px 5px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 2;
              position: relative;
            }

            .marker-arrow {
              width: 0; 
              height: 0; 
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-bottom: 14px solid #3b82f6; /* Default Blue */
              transform-origin: center;
            }
            
            /* Status Colors */
            .status-online .marker-arrow { border-bottom-color: #10b981; } /* Green */
            .status-offline .marker-arrow { border-bottom-color: #ef4444; } /* Red */
            .status-offline .marker-pulse { display: none; }

            @keyframes pulse {
              0% { transform: scale(1); opacity: 0.8; }
              70% { transform: scale(1.6); opacity: 0; }
              100% { transform: scale(1); opacity: 0; }
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            let map;
            let markers = {}; // Changed to object for ID lookup

            function initMap() {
              map = L.map('map', {
                zoomControl: false,
                attributionControl: false
              }).setView([22.5, 114.0], 10);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
              }).addTo(map);
              
              updateVehicles(${JSON.stringify(vehicles)});
            }

            function selectVehicle(id, lat, lng) {
              if (map) {
                map.flyTo([lat, lng], 16, {
                  animate: true,
                  duration: 1.5
                });
                
                const marker = markers[id];
                if (marker) {
                  setTimeout(() => {
                    marker.openPopup();
                  }, 500); // Slight delay to wait for flyTo to start/finish
                }
              }
            }

            function updateVehicles(newVehicles) {
              // Clear existing markers
              Object.values(markers).forEach(m => map.removeLayer(m));
              markers = {};

              if (!newVehicles || newVehicles.length === 0) return;

              const bounds = L.latLngBounds();

              newVehicles.forEach(v => {
                const lat = v.lat / 1000000;
                const lng = v.lng / 1000000;
                const isOnline = v.ol === 1;
                const speed = (v.sp / 10).toFixed(1);
                const heading = v.hx || 0;
                const id = v.vid || v.id;
                
                // Create custom HTML icon
                const iconHtml = \`
                  <div class="marker-container \${isOnline ? 'status-online' : 'status-offline'}">
                    <div class="marker-pulse"></div>
                    <div class="marker-core">
                      <div class="marker-arrow" style="transform: rotate(\${heading}deg);"></div>
                    </div>
                  </div>
                \`;

                const icon = L.divIcon({
                  html: iconHtml,
                  className: '',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                  popupAnchor: [0, -16]
                });

                const marker = L.marker([lat, lng], { icon: icon })
                  .bindPopup(\`
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #1e293b;">\${id}</div>
                      <div style="font-size: 13px; color: #64748b; line-height: 1.4;">
                        <div style="display: flex; justify-content: space-between;">
                          <span>Status:</span>
                          <span style="font-weight: 500; color: \${isOnline ? '#10b981' : '#ef4444'}">\${isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                          <span>Speed:</span>
                          <span style="font-weight: 500; color: #333;">\${speed} km/h</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                          <span>Updated:</span>
                          <span style="font-size: 11px;">\${v.gt}</span>
                        </div>
                      </div>
                    </div>
                  \`, {
                    closeButton: false,
                    className: 'modern-popup'
                  });
                
                marker.addTo(map);
                markers[id] = marker;
                bounds.extend([lat, lng]);
              });

              // Only auto-fit bounds if we are NOT centering on a specific vehicle
              if (Object.keys(markers).length > 0 && !window.shouldMaintainCenter) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
              }
            }

            initMap();
          </script>
        </body>
      </html>
    `;
  };

  // Handle centering on specific vehicle
  useEffect(() => {
    if (centerOn && webviewRef.current) {
      const lat = formatCoordinate(centerOn.lat);
      const lng = formatCoordinate(centerOn.lng);

      // Set flag to prevent auto-fit from overriding this center
      // injectJavaScript runs async, so we assume it happens
      webviewRef.current.injectJavaScript(`
        window.shouldMaintainCenter = true;
        selectVehicle("${centerOn.vid || centerOn.id}", ${lat}, ${lng});
        setTimeout(() => { window.shouldMaintainCenter = false; }, 3000); // Reset after delay
      `);
    }
  }, [centerOn]);

  // Update map when vehicles prop changes
  useEffect(() => {
    if (webviewRef.current) {
      const script = `updateVehicles(${JSON.stringify(vehicles)});`;
      webviewRef.current.injectJavaScript(script);
    }
  }, [vehicles]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: getMapHtml(), baseUrl: '' }} // baseUrl is important for Android
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => <ActivityIndicator size="large" color="#0000ff" style={styles.loading} />}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onMessage={(event) => {
          console.log('WebView message:', event.nativeEvent.data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18, // Half of size "large"
    marginTop: -18,
  }
});
