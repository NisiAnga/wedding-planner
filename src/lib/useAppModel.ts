import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database, AdminConfig } from './database';
import { Guest, CoupleDesign } from '../types';
import { DEFAULT_DESIGN, INITIAL_GUESTS } from '../presets';

export function useAppModel() {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [isDeviceAuthorized, setIsDeviceAuthorized] = useState<boolean>(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [design, setDesign] = useState<CoupleDesign>(DEFAULT_DESIGN);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize device ID and load from AsyncStorage database
  useEffect(() => {
    async function initDevice() {
      try {
        let id = await AsyncStorage.getItem('wedding_device_id');
        if (!id) {
          id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
          await AsyncStorage.setItem('wedding_device_id', id);
        }
        setDeviceId(id);

        // Load config
        const config = await database.getAdminConfig();
        setIsActivated(config.isActivated);
        if (config.isActivated && config.activatedDeviceId) {
          setIsDeviceAuthorized(config.activatedDeviceId === id);
        } else {
          setIsDeviceAuthorized(true);
        }

        // Load design & guests
        const loadedDesign = await database.getDesign();
        setDesign(loadedDesign);

        const loadedGuests = await database.getGuests();
        setGuests(loadedGuests);

        // Check session auth
        const sessionToken = await AsyncStorage.getItem('admin_token');
        if (sessionToken && sessionToken === config.adminPasskey) {
          setIsAdminAuthenticated(true);
        }
      } catch (err) {
        console.error('Error loading database:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initDevice();
  }, []);

  const handleActivate = async (passkey: string) => {
    const res = await database.activateAdmin(passkey, deviceId);
    if (res.success) {
      setIsActivated(true);
      setIsDeviceAuthorized(true);
      setIsAdminAuthenticated(true);
      await AsyncStorage.setItem('admin_token', passkey.trim());
    }
    return res;
  };

  const handleLogin = async (passkey: string) => {
    const res = await database.loginAdmin(passkey, deviceId);
    if (res.success) {
      setIsAdminAuthenticated(true);
      await AsyncStorage.setItem('admin_token', passkey.trim());
    }
    return res;
  };

  const handleLogout = async () => {
    setIsAdminAuthenticated(false);
    await AsyncStorage.removeItem('admin_token');
  };

  const updateDesign = async (updated: CoupleDesign) => {
    setDesign(updated);
    await database.saveDesign(updated);
  };

  const updateGuestsList = async (updated: Guest[]) => {
    setGuests(updated);
    await database.saveGuests(updated);
  };

  const resetAllPresets = async () => {
    await AsyncStorage.removeItem('wedding_device_id');
    await AsyncStorage.removeItem('admin_token');
    
    const freshDesign = { ...DEFAULT_DESIGN };
    const freshGuests = [ ...INITIAL_GUESTS ];
    const freshConfig = {
      adminPasskey: 'admin123',
      activatedDeviceId: '',
      isActivated: false
    };

    await AsyncStorage.setItem('wedding_design', JSON.stringify(freshDesign));
    await AsyncStorage.setItem('wedding_guests', JSON.stringify(freshGuests));
    await AsyncStorage.setItem('wedding_config', JSON.stringify(freshConfig));
    
    // Trigger reload
    setDesign(freshDesign);
    setGuests(freshGuests);
    setIsActivated(false);
    setIsDeviceAuthorized(true);
    setIsAdminAuthenticated(false);
  };

  return {
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
  };
}
export type AppModel = ReturnType<typeof useAppModel>;
