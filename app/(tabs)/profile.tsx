import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  FlatList,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth, UserProfile } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { LogOut, User, TriangleAlert as AlertTriangle, Eye, EyeOff, RefreshCw, Key, UserCheck, UserX, Shield, Clock, Users, Trash2, CreditCard as Edit2, X } from 'lucide-react-native';

export default function ProfileScreen() {
  const { jsession, account, profile, fleetAuthError, signOut, updateFleetCredentials, retryFleetLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [newFleetAccount, setNewFleetAccount] = useState(profile?.fleet_account || '');
  const [newFleetPassword, setNewFleetPassword] = useState('');
  const [showFleetPassword, setShowFleetPassword] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [credentialError, setCredentialError] = useState('');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const handleLogout = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setShowConfirm(false);

    try {
      await signOut();
      router.replace('/login');
    } catch {
      setErrorMessage('An error occurred during logout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!newFleetAccount || !newFleetPassword) {
      setCredentialError('Please fill in both fields');
      return;
    }

    setCredentialLoading(true);
    setCredentialError('');

    const result = await updateFleetCredentials(newFleetAccount, newFleetPassword);
    if (result.error) {
      setCredentialError(result.error);
    } else {
      setShowCredentialForm(false);
      setNewFleetPassword('');
    }
    setCredentialLoading(false);
  };

  const handleRetryFleet = async () => {
    setIsLoading(true);
    await retryFleetLogin();
    setIsLoading(false);
  };

  const loadUsers = useCallback(async () => {
    if (!supabase || !isAdmin) return;

    try {
      setErrorMessage('');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('email', { ascending: true });

      if (error) {
        setErrorMessage('Failed to load users');
        return;
      }

      setUsers(data || []);
    } catch {
      setErrorMessage('Failed to load users');
    } finally {
      setUsersLoading(false);
      setIsRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (showUserManagement && isAdmin) {
      setUsersLoading(true);
      loadUsers();
    }
  }, [showUserManagement, isAdmin, loadUsers]);

  const handleApprove = async (userId: string) => {
    if (!supabase) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_approved: true })
        .eq('id', userId);

      if (error) {
        setErrorMessage('Failed to approve user');
      } else {
        setUsers(prev =>
          prev.map(u => u.id === userId ? { ...u, is_approved: true } : u)
        );
      }
    } catch {
      setErrorMessage('Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!supabase || userId === profile?.id) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_approved: false })
        .eq('id', userId);

      if (error) {
        setErrorMessage('Failed to revoke access');
      } else {
        setUsers(prev =>
          prev.map(u => u.id === userId ? { ...u, is_approved: false } : u)
        );
      }
    } catch {
      setErrorMessage('Failed to revoke access');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!supabase || userId === profile?.id) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        setErrorMessage('Failed to delete user');
      } else {
        setUsers(prev => prev.filter(u => u.id !== userId));
      }
    } catch {
      setErrorMessage('Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const startEdit = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditEmail(user.email);
    setEditPassword(user.fleet_password);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditEmail('');
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleSaveEdit = async (userId: string) => {
    if (!supabase || !editEmail.trim() || !editPassword.trim()) {
      setErrorMessage('Email and password cannot be empty');
      return;
    }

    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          email: editEmail.trim(),
          fleet_password: editPassword,
        })
        .eq('id', userId);

      if (error) {
        setErrorMessage('Failed to update user');
      } else {
        setUsers(prev =>
          prev.map(u =>
            u.id === userId
              ? { ...u, email: editEmail.trim(), fleet_password: editPassword }
              : u
          )
        );
        cancelEdit();
      }
    } catch {
      setErrorMessage('Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadUsers();
  }, [loadUsers]);

  const renderUserItem = ({ item }: { item: UserProfile }) => {
    const isPending = !item.is_approved;
    const isSelf = item.id === profile?.id;
    const isUserAdmin = item.role === 'admin';
    const isProcessing = actionLoading === item.id;
    const isEditing = editingUserId === item.id;

    if (isEditing) {
      return (
        <View style={styles.userCard}>
          <View style={styles.editFormContainer}>
            <Text style={styles.editFormLabel}>Email</Text>
            <TextInput
              style={styles.editInput}
              placeholder="Email"
              value={editEmail}
              onChangeText={setEditEmail}
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.editFormLabel}>Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.editPasswordInput}
                placeholder="Password"
                value={editPassword}
                onChangeText={setEditPassword}
                secureTextEntry={!showEditPassword}
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                onPress={() => setShowEditPassword(!showEditPassword)}
                style={styles.eyeButton}>
                {showEditPassword ? (
                  <Eye size={20} color="#64748b" />
                ) : (
                  <EyeOff size={20} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.editButtonsContainer}>
              <TouchableOpacity
                style={[styles.editSaveButton, isProcessing && styles.buttonDisabled]}
                onPress={() => handleSaveEdit(item.id)}
                disabled={isProcessing}>
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.editSaveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editCancelButton, isProcessing && styles.buttonDisabled]}
                onPress={cancelEdit}
                disabled={isProcessing}>
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <X size={18} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.userCard, isPending && styles.userCardPending]}>
        <View style={styles.userInfo}>
          <View style={styles.userHeader}>
            <Text style={styles.userEmail}>{item.email}</Text>
            {isUserAdmin && (
              <View style={styles.adminBadge}>
                <Shield size={12} color="#2563eb" />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={styles.userFleetAccount}>Fleet: {item.fleet_account}</Text>
          <View style={styles.passwordRow}>
            <Text style={styles.passwordLabel}>Password:</Text>
            <Text style={styles.passwordValue}>{item.fleet_password}</Text>
          </View>
        </View>

        {!isSelf && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.editIconButton, isProcessing && styles.buttonDisabled]}
              onPress={() => startEdit(item)}
              disabled={isProcessing}>
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Edit2 size={18} color="#ffffff" />
              )}
            </TouchableOpacity>
            {isPending ? (
              <>
                <TouchableOpacity
                  style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
                  onPress={() => handleApprove(item.id)}
                  disabled={isProcessing}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <UserCheck size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, isProcessing && styles.buttonDisabled]}
                  onPress={() => handleDelete(item.id)}
                  disabled={isProcessing}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Trash2 size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.revokeButton, isProcessing && styles.buttonDisabled]}
                  onPress={() => handleRevoke(item.id)}
                  disabled={isProcessing}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <UserX size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, isProcessing && styles.buttonDisabled]}
                  onPress={() => handleDelete(item.id)}
                  disabled={isProcessing}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Trash2 size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const pendingUsers = users.filter(u => !u.is_approved);
  const approvedUsers = users.filter(u => u.is_approved);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <User size={64} color="#2563eb" />
          </View>
          <Text style={styles.title}>
            Hello! <Text style={styles.username}>{account || 'User'}</Text>
          </Text>
          <Text style={styles.subtitle}>{profile?.email}</Text>
          {profile?.role === 'admin' && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Admin</Text>
            </View>
          )}
        </View>

        {fleetAuthError && !showCredentialForm && (
          <View style={styles.warningContainer}>
            <AlertTriangle size={20} color="#f59e0b" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Fleet Connection Failed</Text>
              <Text style={styles.warningText}>
                Your fleet credentials may have changed. Update them to reconnect.
              </Text>
            </View>
            <View style={styles.warningActions}>
              <TouchableOpacity
                style={styles.warningRetryButton}
                onPress={handleRetryFleet}
                disabled={isLoading}>
                <RefreshCw size={16} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.warningUpdateButton}
                onPress={() => {
                  setShowCredentialForm(true);
                  setNewFleetAccount(profile?.fleet_account || '');
                  setNewFleetPassword('');
                }}>
                <Key size={16} color="#f59e0b" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showCredentialForm && (
          <View style={styles.credentialForm}>
            <Text style={styles.credentialTitle}>Update Fleet Credentials</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Fleet Account</Text>
              <TextInput
                style={styles.input}
                value={newFleetAccount}
                onChangeText={setNewFleetAccount}
                autoCapitalize="none"
                editable={!credentialLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Fleet Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter new fleet password"
                  value={newFleetPassword}
                  onChangeText={setNewFleetPassword}
                  secureTextEntry={!showFleetPassword}
                  editable={!credentialLoading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowFleetPassword(!showFleetPassword)}>
                  {showFleetPassword ? (
                    <EyeOff size={20} color="#64748b" />
                  ) : (
                    <Eye size={20} color="#64748b" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {credentialError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{credentialError}</Text>
              </View>
            ) : null}

            <View style={styles.credentialActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCredentialForm(false);
                  setCredentialError('');
                }}
                disabled={credentialLoading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, credentialLoading && styles.buttonDisabled]}
                onPress={handleUpdateCredentials}
                disabled={credentialLoading}>
                {credentialLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save & Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {showConfirm ? (
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmTitle}>Confirm Logout</Text>
            <Text style={styles.confirmText}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirm(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleLogout}>
                <Text style={styles.confirmButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {isAdmin && !showUserManagement && (
          <TouchableOpacity
            style={styles.manageUsersButton}
            onPress={() => setShowUserManagement(true)}>
            <Users size={20} color="#2563eb" />
            <Text style={styles.manageUsersButtonText}>Manage Users</Text>
          </TouchableOpacity>
        )}

        {showUserManagement && isAdmin && (
          <View style={styles.userManagementSection}>
            <View style={styles.sectionHeader}>
              <Users size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>User Management</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowUserManagement(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            {usersLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading users...</Text>
              </View>
            ) : (
              <>
                {pendingUsers.length > 0 && (
                  <View style={styles.subsectionHeader}>
                    <Clock size={16} color="#f59e0b" />
                    <Text style={styles.subsectionTitle}>Pending Approval</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{pendingUsers.length}</Text>
                    </View>
                  </View>
                )}

                <FlatList
                  data={[...pendingUsers, ...approvedUsers]}
                  renderItem={renderUserItem}
                  keyExtractor={item => item.id}
                  scrollEnabled={false}
                  refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
                  }
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Users size={48} color="#cbd5e1" />
                      <Text style={styles.emptyText}>No users found</Text>
                    </View>
                  )}
                />
              </>
            )}
          </View>
        )}

        <View style={styles.actions}>
          {!showCredentialForm && (
            <TouchableOpacity
              style={styles.updateCredButton}
              onPress={() => {
                setShowCredentialForm(true);
                setNewFleetAccount(profile?.fleet_account || '');
                setNewFleetPassword('');
              }}
              disabled={isLoading}>
              <Key size={20} color="#2563eb" />
              <Text style={styles.updateCredButtonText}>Update Fleet Credentials</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.logoutButton, isLoading && styles.buttonDisabled]}
            onPress={() => setShowConfirm(true)}
            disabled={isLoading || showConfirm}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <LogOut size={20} color="#ffffff" />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Fleet Session</Text>
            <Text style={[styles.infoValue, { color: jsession ? '#22c55e' : '#ef4444' }]}>
              {jsession ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Fleet Account</Text>
            <Text style={styles.infoValue}>{profile?.fleet_account || '-'}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>{profile?.role || '-'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  username: {
    color: '#2563eb',
    fontWeight: '800',
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roleBadgeText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#a16207',
    lineHeight: 18,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 8,
  },
  warningRetryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningUpdateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  credentialForm: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  credentialTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  eyeIcon: {
    padding: 12,
  },
  credentialActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  updateCredButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  updateCredButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  confirmContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 24,
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  manageUsersButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  manageUsersButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  userManagementSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  userCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563eb',
  },
  userFleetAccount: {
    fontSize: 12,
    color: '#64748b',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  passwordLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  passwordValue: {
    fontSize: 12,
    color: '#1e293b',
    fontFamily: 'monospace',
    flex: 1,
  },
  actionButtons: {
    marginLeft: 12,
    flexDirection: 'row',
    gap: 8,
  },
  editIconButton: {
    backgroundColor: '#3b82f6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#22c55e',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revokeButton: {
    backgroundColor: '#f59e0b',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 12,
  },
  editFormContainer: {
    flex: 1,
    gap: 12,
  },
  editFormLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  editPasswordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editSaveButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  editSaveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  editCancelButton: {
    backgroundColor: '#dc2626',
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
