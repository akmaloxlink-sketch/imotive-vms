import React, { useState, useEffect, useCallback } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Dimensions, Platform, ActivityIndicator, Text, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { X, MapPin, Maximize, Minimize } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fleetApi, DeviceStatus } from '@/services/fleetApi';
import { useAuth } from '@/contexts/AuthContext';

const isWeb = Platform.OS === 'web';

let LeafletMap: any = null;
let NativeMap: any = null;

if (isWeb) {
  LeafletMap = require('@/components/LeafletMap').LeafletMap;
} else {
  NativeMap = require('@/components/MobileLeafletMap').MobileLeafletMap;
}

interface VideoPlayerProps {
  visible: boolean;
  videoUrl: string;
  vehicleId?: string;
  vehicleName?: string;
  onClose: () => void;
}

export function VideoPlayer({ visible, videoUrl, vehicleId, vehicleName, onClose }: VideoPlayerProps) {
  console.log("VIDEO URL:", videoUrl);
  const { jsession } = useAuth();
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [isLandscape, setIsLandscape] = useState(false);
  const [vehicleStatus, setVehicleStatus] = useState<DeviceStatus[]>([]);
  const [isLoadingMap, setIsLoadingMap] = useState(false);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setIsLandscape(window.width > window.height);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (visible && Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync();
    }

    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    };
  }, [visible]);

  // Poll for vehicle status when modal is visible and vehicleId is provided
  useEffect(() => {
    let intervalId: any;

    const fetchStatus = async () => {
      if (!jsession || !vehicleId || !visible) return;

      try {
        if (vehicleStatus.length === 0) setIsLoadingMap(true);

        const response = await fleetApi.getDeviceStatus(jsession, vehicleId, undefined, {
          toMap: 1,
          language: 'zh',
        });

        if (response.result === 0 && response.status) {
          const validVehicles = response.status.filter(
            (vehicle) => vehicle.lng !== 0 && vehicle.lat !== 0
          );
          setVehicleStatus(validVehicles);
        }
      } catch (error) {
        console.error('Failed to fetch vehicle status for video player map', error);
      } finally {
        setIsLoadingMap(false);
      }
    };

    if (visible && vehicleId) {
      fetchStatus();
      intervalId = setInterval(fetchStatus, 10000); // Poll every 10 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      setVehicleStatus([]);
    };
  }, [visible, vehicleId, jsession]);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
    onClose();
  };

  const toggleOrientation = async () => {
    if (Platform.OS === 'web') return;

    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  };



  const videoWidth = dimensions.width;
  const videoHeight = isLandscape ? dimensions.height : (videoWidth * 2) / 3; // Increased height (3:2 aspect ratio)

  // Calculate map height - fill remaining space in portrait
  const mapHeight = isLandscape ? 0 : dimensions.height - videoHeight;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent={true}
        />
        <View style={[
          styles.header,
          { paddingTop: (insets.top || 20) + 10 }, // Fallback for safe area + small buffer
          !isLandscape && styles.headerBlue,
          isLandscape && styles.headerLandscape
        ]}>
          {!isLandscape && (
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {vehicleName || 'Vehicle Live Feed'}
              </Text>
              {vehicleId && (
                <Text style={styles.headerSubtitle}>ID: {vehicleId}</Text>
              )}
            </View>
          )}
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={toggleOrientation}
              activeOpacity={0.7}
            >
              {isLandscape ? (
                <Minimize size={24} color="#ffffff" />
              ) : (
                <Maximize size={24} color="#ffffff" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[
          styles.videoContainer,
          { width: videoWidth, height: videoHeight },
          isLandscape && styles.videoContainerLandscape
        ]}>

          <WebView
            source={{ uri: videoUrl }}
            originWhitelist={['*']}
            mixedContentMode="always"
            allowFileAccess
            allowUniversalAccessFromFileURLs
            style={styles.webview}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
          />
        </View>

        {!isLandscape && vehicleId && (
          <View style={[styles.mapContainer, { height: mapHeight }]}>
            {isLoadingMap && vehicleStatus.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : vehicleStatus.length > 0 ? (
              <View style={styles.mapWrapper}>
                {isWeb ? (
                  <LeafletMap vehicles={vehicleStatus} />
                ) : (
                  <NativeMap vehicles={vehicleStatus} />
                )}
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <MapPin size={48} color={colors.text.secondary} />
                <View style={{ height: 16 }} />
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: colors.text.secondary,
                  marginBottom: 4
                }}>
                  Location Unavailable
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: colors.text.secondary,
                  textAlign: 'center'
                }}>
                  Waiting for GPS signal...
                </Text>
                <View style={{ height: 16 }} />
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    zIndex: 10,
    backgroundColor: colors.primary, // Primary blue always
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16, // Standard padding
    paddingHorizontal: 16,
    borderBottomWidth: 0, // No border for solid color
    elevation: 4, // Match shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerBlue: {
    backgroundColor: colors.primary,
  },
  headerLandscape: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.md,
    backgroundColor: 'transparent', // Fully transparent in landscape
  },
  headerContent: {
    flex: 1,
    marginRight: spacing.md,
    justifyContent: 'center', // Center vertically
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20, // Match typical header title size
    fontWeight: '600', // Match TabLayout config
    letterSpacing: 0, // Reset custom letter spacing
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '400',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 16, // Standard gap
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    // Removed background and border to match standard header buttons which are usually just icons
  },
  videoContainer: {
    backgroundColor: '#000000',
    zIndex: 2, // Video on top
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // Shadow downwards onto map
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  videoContainerLandscape: {
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mapContainer: {
    width: '100%',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginTop: -16, // Tuck under video
    paddingTop: 16, // Compensate for tuck
    zIndex: 1, // Map behind
    borderTopLeftRadius: 0, // Reset radius if tucking underneath (optional, but cleaner)
    borderTopRightRadius: 0,
  },
  mapWrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: spacing.xl,
  },
});
