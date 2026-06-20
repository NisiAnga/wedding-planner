import { PresetTheme, BannerPreset, Guest, CoupleDesign } from "./types";

export const COLOR_PRESETS: PresetTheme[] = [
  {
    name: "Napa Sage",
    primary: "#5F7464",
    accent: "#B5A475",
    border: "#C2CBC4",
    canvas: "#F7F8F7",
  },
  {
    name: "Blush & Rose Gold",
    primary: "#AC757B",
    accent: "#D1A390",
    border: "#ECD7D9",
    canvas: "#FDFBFA",
  },
  {
    name: "Coastal Blue",
    primary: "#3D5A80",
    accent: "#E07A5F",
    border: "#D1DBE6",
    canvas: "#F8FAFC",
  },
  {
    name: "Terracotta Sunset",
    primary: "#B85A3C",
    accent: "#DCA060",
    border: "#ECD2C4",
    canvas: "#FCFAF7",
  },
  {
    name: "Classic Charcoal",
    primary: "#2C3539",
    accent: "#8A7968",
    border: "#E1E4E6",
    canvas: "#FFFFFF",
  },
];

export const BANNER_PRESETS: BannerPreset[] = [
  {
    name: "Napa Vineyard Sunset",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200",
  },
  {
    name: "Classic Elegant Arch",
    url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=1200",
  },
  {
    name: "Warm Terracotta Floral",
    url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&q=80&w=1200",
  },
  {
    name: "Glasshouse Greenhouse",
    url: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&q=80&w=1200",
  },
];

export const DEFAULT_DESIGN: CoupleDesign = {
  coupleNames: "Sophia & Alexander",
  weddingDate: "October 16, 2026",
  weddingVenue: "Auberge du Soleil, Napa Valley, CA",
  weddingHall: "The Grand Pavilion & Garden Terrace",
  inviteeNames: "Our Cherished Family & Friends",
  rsvpDeadline: "September 1, 2026",
  selectedPresetTheme: "Napa Sage",
  primaryColor: "#5F7464",
  accentColor: "#B5A475",
  borderColor: "#C2CBC4",
  canvasBg: "#F7F8F7",
  bannerUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200",
  borderStyle: "Double Classic",
  googleSheetsUrl: "",
  spreadSheetUrl: "",
  invitationWelcome: "We are so excited to celebrate our love with our dearest friends and family on our wedding day. Please let us know if you can make it using the RSVP form below.",
  enableMealSelection: true,
  mealOptions: "Filet Mignon (Truffle demi-glace), Pan-Seared King Salmon, Gnocchi (V) (Wild mushroom), Kids Mac & Cheese",
  enableDietaryRestrictions: true,
  enableSongRequests: true,
  enablePlusOnesGlobally: true,
};

export const INITIAL_GUESTS: Guest[] = [
  {
    id: "g1",
    name: "Sophia Carter",
    householdId: "h1",
    householdName: "Carter Family",
    isAttending: null,
    mealSelection: "",
    dietaryRestrictions: "",
    hasPlusOneAllowed: true,
    plusOneName: "",
    songRequest: "",
  },
  {
    id: "g2",
    name: "James Carter",
    householdId: "h1",
    householdName: "Carter Family",
    isAttending: null,
    mealSelection: "",
    dietaryRestrictions: "",
    hasPlusOneAllowed: false,
    plusOneName: "",
    songRequest: "",
  },
  {
    id: "g3",
    name: "Olivia Smith",
    householdId: "h2",
    householdName: "Smith Household",
    isAttending: null,
    mealSelection: "",
    dietaryRestrictions: "",
    hasPlusOneAllowed: true,
    plusOneName: "",
    songRequest: "",
  },
  {
    id: "g4",
    name: "Evelyn Smith",
    householdId: "h2",
    householdName: "Smith Household",
    isAttending: null,
    mealSelection: "",
    dietaryRestrictions: "Gluten-Free",
    hasPlusOneAllowed: false,
    plusOneName: "",
    songRequest: "",
  },
  {
    id: "g5",
    name: "Michael Davis",
    householdId: "h3",
    householdName: "Michael Davis & Guest",
    isAttending: true,
    mealSelection: "Filet Mignon",
    dietaryRestrictions: "No Peanuts",
    hasPlusOneAllowed: true,
    plusOneName: "Sarah Jenkins",
    songRequest: "September - Earth, Wind & Fire",
  },
  {
    id: "g6",
    name: "Emma Wilson",
    householdId: "h4",
    householdName: "Emma Wilson",
    isAttending: false,
    mealSelection: "",
    dietaryRestrictions: "",
    hasPlusOneAllowed: false,
    plusOneName: "",
    songRequest: "",
  },
];

export const GOOGLE_SHEETS_SCRIPT_TEMPLATE = `// Google Sheets Apps Script Web Service For Wedding RSVP Synchronizer
// Copy and Paste this code directly into your Google Apps Script editor.

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // 10s queue handling to prevent concurrency errors
  
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var payload = JSON.parse(e.postData.contents);
    var timestamp = new Date();
    
    // Auto-create descriptive headers if the sheet is completely empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Guest ID", 
        "Guest Name", 
        "Household ID", 
        "Household Name", 
        "RSVP Status", 
        "Meal Selection", 
        "Dietary Restrictions", 
        "Plus One Name", 
        "Song Request", 
        "Timestamp"
      ]);
      // Format the header line beautifully
      sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#EDF2F7");
    }
    
    // Support unified batch updates (multiple household RSVPs submitted together)
    var guestsToSave = Array.isArray(payload) ? payload : [payload];
    var lastRow = sheet.getLastRow();
    
    for (var i = 0; i < guestsToSave.length; i++) {
      var guest = guestsToSave[i];
      var guestId = guest.id;
      var foundIndex = -1;
      
      // Look up if this Guest ID is already in our Google Sheet
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var row = 0; row < ids.length; row++) {
          if (ids[row][0] == guestId) {
            foundIndex = row + 2; // Rows are 1-indexed and header is at row 1
            break;
          }
        }
      }
      
      var statusString = "Pending";
      if (guest.isAttending === true) statusString = "Accepts";
      if (guest.isAttending === false) statusString = "Declines";
      
      var rowData = [
        guest.id,
        guest.name,
        guest.householdId,
        guest.householdName,
        statusString,
        guest.mealSelection || "N/A",
        guest.dietaryRestrictions || "None",
        guest.plusOneName || "N/A",
        guest.songRequest || "None",
        timestamp
      ];
      
      if (foundIndex !== -1) {
        // Upsert mode: Update the existing guest row
        sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        // Append mode: Insert a fresh guest row
        sheet.appendRow(rowData);
      }
    }
    
    // Return standard success configuration
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Successfully synchronized " + guestsToSave.length + " RSVPs" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`;
