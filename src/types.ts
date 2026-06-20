export interface Guest {
  id: string;
  name: string;
  householdId: string;
  householdName: string;
  isAttending: boolean | null; // null = pending, true = joyfully accepted, false = regretfully declined
  mealSelection: string;
  dietaryRestrictions: string;
  hasPlusOneAllowed: boolean;
  plusOneName: string;
  songRequest: string;
  lastUpdated?: string;
  boundDeviceId?: string;
}

export interface CoupleDesign {
  coupleNames: string;
  weddingDate: string;
  weddingVenue: string;
  weddingHall: string;
  inviteeNames: string;
  rsvpDeadline: string;
  selectedPresetTheme: string;
  primaryColor: string;
  accentColor: string;
  borderColor: string;
  canvasBg: string;
  bannerUrl: string;
  borderStyle: string; // "Modern Rounded" | "Double Classic" | "Vintage Regal" | "Top Accent Stripe"
  googleSheetsUrl: string;
  spreadSheetUrl?: string;
  // RSVP Form Customization fields
  invitationWelcome: string;
  enableMealSelection: boolean;
  mealOptions: string; // Comma-separated list
  enableDietaryRestrictions: boolean;
  enableSongRequests: boolean;
  enablePlusOnesGlobally: boolean;
}

export interface PresetTheme {
  name: string;
  primary: string;
  accent: string;
  border: string;
  canvas: string;
}

export interface BannerPreset {
  name: string;
  url: string;
}
