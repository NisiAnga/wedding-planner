import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppModel } from '../lib/useAppModel';
import ActivationGate from '../components/ActivationGate';
import AdminCustomizer from '../components/AdminCustomizer';
import GuestInvitation from '../components/GuestInvitation';

export default function HomeScreen() {
  const params = useLocalSearchParams();
  const guestQuery = (params.g as string) || (params.guest as string) || '';

  const {
    deviceId,
    isActivated,
    isDeviceAuthorized,
    isAdminAuthenticated,
    design,
    guests,
    isLoading,
    handleActivate,
    handleLogin,
    handleLogout,
    updateDesign,
    updateGuestsList,
    resetAllPresets
  } = useAppModel();

  // Local preview toggle inside Customizer
  const [showPreview, setShowPreview] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5F7464" />
        <Text style={styles.loadingText}>Loading Wedding Planner...</Text>
      </View>
    );
  }

  // 1. Check if we are rendering Guest RSVP View (Web + has URL query parameters, or active preview)
  const isGuestView = Platform.OS === 'web' ? (!!guestQuery || params.view === 'invitation') : false;

  if (isGuestView || showPreview) {
    return (
      <GuestInvitation
        guests={guests}
        onGuestsUpdate={updateGuestsList}
        design={design}
        deviceId={deviceId}
        guestNameQuery={guestQuery}
        onClosePreview={showPreview ? () => setShowPreview(false) : undefined}
      />
    );
  }

  // 2. Render Administration Authentication / Gating Wizards
  if (!isAdminAuthenticated) {
    return (
      <ActivationGate
        isActivated={isActivated}
        isDeviceAuthorized={isDeviceAuthorized}
        onActivate={handleActivate}
        onLogin={handleLogin}
        designPrimaryColor={design.primaryColor}
      />
    );
  }

  // 3. Render Couple Customization Panel Dashboard (Admin view)
  return (
    <AdminCustomizer
      design={design}
      onDesignUpdate={updateDesign}
      guests={guests}
      onGuestsUpdate={updateGuestsList}
      onLogout={handleLogout}
      onReset={resetAllPresets}
      onPreviewGuest={() => setShowPreview(true)}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'serif',
  },
});
