import AsyncStorage from '@react-native-async-storage/async-storage';
import { Guest, CoupleDesign } from '../types';
import { DEFAULT_DESIGN, INITIAL_GUESTS } from '../presets';

const KEYS = {
  DESIGN: 'wedding_design',
  GUESTS: 'wedding_guests',
  CONFIG: 'wedding_config'
};

export interface AdminConfig {
  adminPasskey: string;
  activatedDeviceId: string;
  isActivated: boolean;
}

export const database = {
  async getDesign(): Promise<CoupleDesign> {
    try {
      const data = await AsyncStorage.getItem(KEYS.DESIGN);
      return data ? JSON.parse(data) : DEFAULT_DESIGN;
    } catch {
      return DEFAULT_DESIGN;
    }
  },

  async saveDesign(design: CoupleDesign): Promise<void> {
    await AsyncStorage.setItem(KEYS.DESIGN, JSON.stringify(design));
  },

  async getGuests(): Promise<Guest[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.GUESTS);
      return data ? JSON.parse(data) : INITIAL_GUESTS;
    } catch {
      return INITIAL_GUESTS;
    }
  },

  async saveGuests(guests: Guest[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.GUESTS, JSON.stringify(guests));
  },

  async getAdminConfig(): Promise<AdminConfig> {
    const defaultConfig: AdminConfig = {
      adminPasskey: 'admin123',
      activatedDeviceId: '',
      isActivated: false
    };
    try {
      const data = await AsyncStorage.getItem(KEYS.CONFIG);
      return data ? { ...defaultConfig, ...JSON.parse(data) } : defaultConfig;
    } catch {
      return defaultConfig;
    }
  },

  async saveAdminConfig(config: AdminConfig): Promise<void> {
    await AsyncStorage.setItem(KEYS.CONFIG, JSON.stringify(config));
  },

  async activateAdmin(passkey: string, deviceId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getAdminConfig();
    if (config.isActivated && config.activatedDeviceId) {
      return { success: false, error: 'Application already activated on another device.' };
    }
    if (passkey.trim() !== config.adminPasskey) {
      return { success: false, error: 'Invalid passkey.' };
    }
    config.isActivated = true;
    config.activatedDeviceId = deviceId;
    await this.saveAdminConfig(config);
    return { success: true };
  },

  async loginAdmin(passkey: string, deviceId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getAdminConfig();
    if (!config.isActivated) {
      return { success: false, error: 'Application not activated yet.' };
    }
    if (config.activatedDeviceId && config.activatedDeviceId !== deviceId) {
      return { success: false, error: 'Access denied. Bound to another device.' };
    }
    if (passkey !== config.adminPasskey) {
      return { success: false, error: 'Invalid passkey.' };
    }
    return { success: true };
  },

  async bindGuestDevice(guestId: string, deviceId: string): Promise<{ success: boolean; error?: string }> {
    const guests = await this.getGuests();
    const guest = guests.find((g) => g.id === guestId);
    if (!guest) {
      return { success: false, error: 'Guest not found.' };
    }
    if (guest.boundDeviceId && guest.boundDeviceId !== deviceId) {
      return { success: false, error: 'Link is already bound to another device.' };
    }
    guest.boundDeviceId = deviceId;
    await this.saveGuests(guests);
    return { success: true };
  },

  async updateGuestRSVPs(rsvpUpdates: Guest[], deviceId: string): Promise<{ success: boolean; error?: string }> {
    const guests = await this.getGuests();
    
    // Validate bindings
    for (const update of rsvpUpdates) {
      const match = guests.find((g) => g.id === update.id);
      if (match && match.boundDeviceId && match.boundDeviceId !== deviceId) {
        return { success: false, error: `Access denied. Guest ${match.name} is bound to another device.` };
      }
    }

    // Apply updates
    const updated = guests.map((g) => {
      const update = rsvpUpdates.find((u) => u.id === g.id);
      if (update) {
        return {
          ...g,
          isAttending: update.isAttending,
          mealSelection: update.mealSelection,
          dietaryRestrictions: update.dietaryRestrictions,
          plusOneName: update.plusOneName,
          songRequest: update.songRequest,
          lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
      return g;
    });

    await this.saveGuests(updated);
    return { success: true };
  }
};
