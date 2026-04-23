import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, RefreshControl, ScrollView, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { fleetApi, DeviceStatus } from '@/services/fleetApi';
import { colors, spacing, typography } from '@/constants/theme';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MapPin, List, X, Search, Truck, Wifi, WifiOff } from 'lucide-react-native';

const isWeb = Platform.OS === 'web';

let LeafletMap: any = null;
let NativeMap: any = null;

if (isWeb) {
  LeafletMap = require('@/components/LeafletMap').LeafletMap;
} else {
  NativeMap = require('@/components/MobileLeafletMap').MobileLeafletMap;
}

export default function MapScreen() {
  const { jsession, fleetAuthError } = useAuth();
  const [vehicles, setVehicles] = useState<DeviceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // New State for Vehicle List Feature
  const [listVisible, setListVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<DeviceStatus | null>(null);

  const loadVehiclePositions = useCallback(async () => {
    if (!jsession) return;

    try {
      setErrorMessage('');

      const response = await fleetApi.getDeviceStatus(jsession, undefined, undefined, {
        toMap: 1,
        language: 'zh',
      });

      if (response.result === 0 && response.status) {
        const validVehicles = response.status.filter(
          (vehicle) => vehicle.lng !== 0 && vehicle.lat !== 0
        );
        setVehicles(validVehicles);
      } else {
        setErrorMessage(response.message || 'Failed to load vehicle positions');
      }
    } catch (error) {
      setErrorMessage('Failed to load vehicle positions. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [jsession]);

  useEffect(() => {
    if (jsession) {
      loadVehiclePositions();
    } else {
      setIsLoading(false);
    }
  }, [jsession, loadVehiclePositions]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadVehiclePositions();
  }, [loadVehiclePositions]);

  const handleSelectVehicle = (vehicle: DeviceStatus) => {
    setSelectedVehicle(vehicle);
    setListVisible(false);
  };

  const renderVehicleItem = ({ item }: { item: DeviceStatus }) => {
    const isOnline = item.ol === 1;
    return (
      <TouchableOpacity
        style={styles.vehicleItem}
        onPress={() => handleSelectVehicle(item)}
      >
        <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{item.vid || item.id}</Text>
          <Text style={styles.vehicleDetail}>
            {(item.sp / 10).toFixed(1)} km/h • {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <MapPin size={20} color={colors.primary} />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading map..." />;
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
        <ErrorBanner message={errorMessage} onRetry={loadVehiclePositions} />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.centerContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
        }
      >
        <MapPin size={64} color="#cbd5e1" />
        <Text style={styles.emptyText}>No vehicles with GPS data found</Text>
        <Text style={styles.emptySubtext}>Pull down to refresh</Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {isWeb ? (
        <LeafletMap vehicles={vehicles} />
      ) : (
        <NativeMap vehicles={vehicles} centerOn={selectedVehicle} />
      )}

      {/* List Button (FAB) */}
      <TouchableOpacity
        style={styles.listButton}
        onPress={() => setListVisible(true)}
        activeOpacity={0.8}
      >
        <List size={24} color="#fff" />
        <Text style={styles.listButtonText}>List</Text>
      </TouchableOpacity>

      {/* Vehicle List Modal */}
      <Modal
        visible={listVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setListVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle</Text>
              <TouchableOpacity onPress={() => setListVisible(false)} style={styles.closeButton}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={vehicles}
              renderItem={renderVehicleItem}
              ListHeaderComponent={() => {
                const onlineCount = vehicles.filter(v => v.ol === 1).length;
                const offlineCount = vehicles.length - onlineCount;
                const totalCount = vehicles.length;

                return (
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
              }}
              keyExtractor={(item) => item.id || item.vid || ''}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
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
  listButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  listButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
  },
  vehicleDetail: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
