import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { fleetApi, Vehicle, DeviceStatus } from '@/services/fleetApi';
import { Truck, Wifi, WifiOff, Play, Gauge, Clock } from 'lucide-react-native';
import { colors, shadows, spacing, typography, borderRadius } from '@/constants/theme';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { VideoPlayer } from '@/components/VideoPlayer';
import { supabase, isSupabaseConfigured } from '@/services/supabase';

// const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
// const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

export default function VehiclesScreen() {
  const { jsession, fleetAuthError } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [speedMap, setSpeedMap] = useState<Map<string, { sp: number; pk: number; gt: string }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string | undefined>(undefined);

  const loadVehicles = useCallback(async () => {
    if (!jsession) return;

    try {
      setErrorMessage('');

      const [vehicleResult, statusResult, deviceResult, deviceStatusResult] = await Promise.allSettled([
        fleetApi.getVehicles(jsession),
        fleetApi.getDeviceOnlineStatus(jsession),
        fleetApi.getDeviceByVehicle(jsession),
        fleetApi.getDeviceStatus(jsession, undefined, undefined, { toMap: 1, language: 'zh' }),
      ]);

      if (vehicleResult.status === 'rejected') {
        throw vehicleResult.reason;
      }

      const vehicleResponse = vehicleResult.value;

      if (vehicleResponse.vehicles) {
        const vehiclesList = vehicleResponse.vehicles;

        const statusMap = new Map<string, number>();
        if (statusResult.status === 'fulfilled' &&
          statusResult.value.onlines &&
          statusResult.value.onlines.length > 0) {
          statusResult.value.onlines.forEach(status => {
            statusMap.set(status.vid || '', status.online);
          });
        }

        if (deviceResult.status === 'fulfilled' &&
          deviceResult.value.result === 0 &&
          deviceResult.value.devices &&
          deviceResult.value.devices.length > 0) {

          // Background sync to Supabase - don't await this for UI rendering
          if (isSupabaseConfigured && supabase) {
            const devicesToSync = deviceResult.value.devices;
            (async () => {
              try {
                // Upsert in batches to avoid overwhelming the connection if possible,
                // or just fire and forget individually but don't block render.
                for (const device of devicesToSync) {
                  await supabase
                    .from('vehicle_devices')
                    .upsert(
                      {
                        vehicle_id: device.vid,
                        device_id: device.did,
                        device_type: device.type,
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: 'vehicle_id' }
                    );
                }
              } catch (err) {
                console.log('Background sync failed', err);
              }
            })();
          }
        }

        let deviceData = null;
        // Only fetch from Supabase if we really need to (e.g. API failed? or just as backup?)
        // The original code seemed to fetch it to merge.
        // To speed up, we can skip waiting for Supabase read if we have API results,
        // OR we run it in parallel with the initial API calls if it's critical.
        // For now, let's keep the read but make it non-blocking if possible,
        // or just rely on API data if available.

        // Actually, looking at the logic:
        // 1. We get devices from API.
        // 2. We sync to Supabase.
        // 3. We READ from Supabase.
        // 4. We merge.

        // Reading immediately after writing (in the previous code) was only catching what we just wrote + old data.
        // If API is up, we have the data in `deviceResult`.
        // We only strictly NEED Supabase data if `deviceResult` failed or was partial?

        // Let's prioritize API stats.

        const deviceMap = new Map<string, string>();

        // Populate from API result first
        if (deviceResult.status === 'fulfilled' &&
          deviceResult.value.result === 0 &&
          deviceResult.value.devices) {
          deviceResult.value.devices.forEach(device => {
            deviceMap.set(device.vid, device.did);
          });
        }

        // If we want to use Supabase as a fallback, we should have fetched it in the Promise.allSettled to be faster.
        // Fetching it here sequentially slows us down.
        // If users really need it, we should add it to the initial Promise.all.
        // check if we really need it. If API is successful, we probably don't need to wait for Supabase READ.

        const newSpeedMap = new Map<string, { sp: number; pk: number; gt: string }>();
        if (deviceStatusResult.status === 'fulfilled' &&
          deviceStatusResult.value.result === 0 &&
          deviceStatusResult.value.status) {
          deviceStatusResult.value.status.forEach((ds: DeviceStatus) => {
            if (ds.vid) {
              newSpeedMap.set(ds.vid, { sp: ds.sp, pk: ds.pk, gt: ds.gt });
            }
          });
        }
        setSpeedMap(newSpeedMap);

        const vehiclesWithData = vehiclesList.map(vehicle => ({
          ...vehicle,
          online: statusMap.get(vehicle.nm) ?? undefined,
          did: deviceMap.get(vehicle.nm) || vehicle.did,
        }));

        setVehicles(vehiclesWithData);
      } else {
        setErrorMessage(vehicleResponse.message || 'No vehicles found');
      }
    } catch (error) {
      setErrorMessage('Failed to load vehicles. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [jsession]);

  useEffect(() => {
    if (jsession) {
      loadVehicles();
    } else {
      setIsLoading(false);
    }
  }, [jsession, loadVehicles]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadVehicles();
  }, [loadVehicles]);

  const handlePlayVideo = useCallback((vehicle: Vehicle) => {
    if (!vehicle.did) {
      Alert.alert('No Device', 'This vehicle does not have a device ID assigned.');
      return;
    }

    const videoUrl = `http://chinamdvr.com:8088/808gps/open/player/video.html?lang=en&devIdno=${vehicle.did}&jsession=${jsession}&stream=1`;

    setCurrentVideoUrl(videoUrl);
    setSelectedVehicleId(vehicle.did); // Use device ID for map tracking
    setSelectedVehicleName(vehicle.nm);
    setVideoModalVisible(true);
  }, [jsession]);

  const handleCloseVideo = useCallback(() => {
    setVideoModalVisible(false);
    setCurrentVideoUrl('');
    setSelectedVehicleId(undefined);
    setSelectedVehicleName(undefined);
  }, []);

  const renderVehicleItem = useCallback(({ item }: { item: Vehicle }) => {
    const isOnline = item.online === 1;
    const hasStatus = item.online !== undefined;
    const statusData = speedMap.get(item.nm);
    const speedKmh = statusData !== undefined ? statusData.sp / 10 : undefined;
    const parkingSecs = statusData?.pk ?? 0;
    const gpsTime = statusData?.gt ?? '';
    const isRunning = speedKmh !== undefined && speedKmh > 0;

    const formatParking = (secs: number) => {
      if (secs <= 0) return '';
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    return (
      <View style={styles.vehicleCard}>
        <View style={[
          styles.vehicleIcon,
          isOnline && styles.vehicleIconOnline,
          hasStatus && !isOnline && styles.vehicleIconOffline
        ]}>
          <Truck size={32} color={isOnline ? colors.status.online : hasStatus ? '#94a3b8' : colors.primary} />
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{item.nm}</Text>
          {item.did && <Text style={styles.vehicleId}>Device ID: {item.did}</Text>}
          <View style={styles.badgeRow}>
            {hasStatus && (
              <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
                {isOnline ? (
                  <Wifi size={12} color={colors.status.online} />
                ) : (
                  <WifiOff size={12} color={colors.status.offline} />
                )}
                <Text style={[styles.badgeText, isOnline ? styles.statusOnline : styles.statusOffline]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            )}
            {speedKmh !== undefined && (
              <View style={[styles.badge, isRunning ? styles.badgeRunning : styles.badgeStopped]}>
                <Gauge size={12} color={isRunning ? '#0369a1' : '#64748b'} />
                <Text style={[styles.badgeText, isRunning ? styles.statusRunning : styles.statusStopped]}>
                  {isRunning
                    ? `Running ${speedKmh.toFixed(1)} km/h`
                    : parkingSecs > 0 ? `Stopped ${formatParking(parkingSecs)}` : 'Stopped'}
                </Text>
              </View>
            )}
            {gpsTime && (
              <View style={styles.badge}>
                <Clock size={12} color={colors.text.secondary} />
                <Text style={styles.badgeText}>{gpsTime}</Text>
              </View>
            )}
          </View>
        </View>
        {item.did && isOnline && (
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => handlePlayVideo(item)}
            activeOpacity={0.7}
          >
            <Play size={20} color="#ffffff" fill="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [handlePlayVideo, speedMap]);

  if (isLoading) {
    return <LoadingSpinner message="Loading vehicles..." />;
  }

  if (fleetAuthError && !jsession) {
    return (
      <View style={styles.centerContainer}>
        <ErrorBanner message="Fleet connection failed. Go to Profile to update your fleet credentials." />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centerContainer}>
        <ErrorBanner message={errorMessage} onRetry={loadVehicles} />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Truck size={64} color="#cbd5e1" />
        <Text style={styles.emptyText}>No vehicles found</Text>
        <Text style={styles.emptySubtext}>
          Pull down to refresh
        </Text>
      </View>
    );
  }

  const onlineCount = vehicles.filter(v => v.online === 1).length;
  const offlineCount = vehicles.length - onlineCount;
  const totalCount = vehicles.length;

  const renderHeader = () => (
    <View style={styles.statsContainer}>
      <View style={[styles.statCard, styles.statCardTotal]}>
        <View style={styles.statHeader}>
          <Truck size={16} color={colors.text.secondary} />
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <Text style={[styles.statValue, { color: colors.text.primary }]}>{totalCount}</Text>
      </View>
      <View style={[styles.statCard, styles.statCardOnline]}>
        <View style={styles.statHeader}>
          <Wifi size={16} color={colors.status.online} />
          <Text style={styles.statLabel}>Online</Text>
        </View>
        <Text style={[styles.statValue, { color: colors.status.online }]}>{onlineCount}</Text>
      </View>
      <View style={[styles.statCard, styles.statCardOffline]}>
        <View style={styles.statHeader}>
          <WifiOff size={16} color={colors.status.offline} />
          <Text style={styles.statLabel}>Offline</Text>
        </View>
        <Text style={[styles.statValue, { color: colors.status.offline }]}>{offlineCount}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={vehicles}
        renderItem={renderVehicleItem}
        ListHeaderComponent={renderHeader}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#2563eb"
          />
        }
      />
      <VideoPlayer
        visible={videoModalVisible}
        videoUrl={currentVideoUrl}
        vehicleId={selectedVehicleId}
        vehicleName={selectedVehicleName}
        onClose={handleCloseVideo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
  },
  listContent: {
    padding: spacing.md,
  },
  vehicleCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.small,
  },
  vehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  vehicleIconOnline: {
    backgroundColor: '#f0fdf4',
  },
  vehicleIconOffline: {
    backgroundColor: '#f8fafc',
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  vehicleId: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeOnline: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeOffline: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badgeRunning: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  badgeStopped: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  statusOnline: {
    color: colors.status.online,
  },
  statusOffline: {
    color: colors.status.offline,
  },
  statusRunning: {
    color: '#0369a1',
  },
  statusStopped: {
    color: '#64748b',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.text.secondary,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
    ...shadows.small,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.small,
    borderWidth: 1,
  },
  statCardTotal: {
    borderColor: '#e2e8f0',
  },
  statCardOnline: {
    borderColor: '#dcfce7',
    backgroundColor: '#f0fdf4',
  },
  statCardOffline: {
    borderColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: 'bold',
  },
});
