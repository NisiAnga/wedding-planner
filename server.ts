import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve DB paths
const DATA_DIR = path.join(process.cwd(), "data");
const GUESTS_FILE = path.join(DATA_DIR, "guests.json");
const DESIGN_FILE = path.join(DATA_DIR, "design.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json({ limit: "5mb" }));

// Default initial guest template matching presets.ts
const INITIAL_GUESTS = [
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

// Helper to read and write guest list
function readGuests() {
  if (!fs.existsSync(GUESTS_FILE)) {
    fs.writeFileSync(GUESTS_FILE, JSON.stringify(INITIAL_GUESTS, null, 2));
    return INITIAL_GUESTS;
  }
  try {
    return JSON.parse(fs.readFileSync(GUESTS_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading guests:", error);
    return INITIAL_GUESTS;
  }
}

function writeGuests(data: any) {
  fs.writeFileSync(GUESTS_FILE, JSON.stringify(data, null, 2));
}

// Config file read/write helpers
function readConfig() {
  const defaultConfig = { adminPasskey: "admin123", activatedDeviceId: "", isActivated: false };
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return { ...defaultConfig, ...data };
  } catch (error) {
    console.error("Error reading config:", error);
    return defaultConfig;
  }
}

function writeConfig(config: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Design file read/write helpers
function readDesign() {
  if (!fs.existsSync(DESIGN_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(DESIGN_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading design:", error);
    return null;
  }
}

function writeDesign(design: any) {
  fs.writeFileSync(DESIGN_FILE, JSON.stringify(design, null, 2));
}

// Get configured admin passkey
function getAdminPasskey() {
  if (process.env.ADMIN_PASSKEY) {
    return process.env.ADMIN_PASSKEY;
  }
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }
  const config = readConfig();
  return config.adminPasskey || config.adminPassword || "admin123";
}

// Authentication middleware
function adminAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expectedPasskey = getAdminPasskey();
  const config = readConfig();
  
  if (!config.isActivated) {
    return res.status(403).json({ error: "Admin panel not activated yet." });
  }

  if (config.activatedDeviceId) {
    const deviceIdHeader = req.headers["x-device-id"];
    if (!deviceIdHeader || deviceIdHeader !== config.activatedDeviceId) {
      return res.status(403).json({ error: "Access denied. Bound to another device." });
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Missing authorization header." });
  }

  const token = authHeader.substring(7);
  if (token !== expectedPasskey) {
    return res.status(401).json({ error: "Unauthorized. Invalid passkey." });
  }

  next();
}

// --- REST endpoints ---

// Admin status (has the app been activated?)
app.get("/api/admin/status", (req, res) => {
  const config = readConfig();
  const deviceId = req.query.deviceId as string;

  const isActivated = !!config.isActivated && !!config.activatedDeviceId;
  const isDeviceAuthorized = !isActivated || (!!deviceId && deviceId === config.activatedDeviceId);

  res.json({ 
    isActivated, 
    isDeviceAuthorized 
  });
});

// Admin activation (binds passkey to first deviceId)
app.post("/api/admin/activate", (req, res) => {
  const { passkey, deviceId } = req.body;
  const config = readConfig();

  if (config.isActivated && config.activatedDeviceId) {
    return res.status(400).json({ error: "This application has already been activated on another device." });
  }

  if (!passkey || typeof passkey !== "string") {
    return res.status(400).json({ error: "Passkey is required." });
  }

  if (!deviceId || typeof deviceId !== "string" || deviceId.trim().length === 0) {
    return res.status(400).json({ error: "Device identifier is required." });
  }

  const expectedPasskey = getAdminPasskey();
  if (passkey.trim() !== expectedPasskey) {
    return res.status(401).json({ error: "Invalid passkey. Activation failed." });
  }

  config.isActivated = true;
  config.activatedDeviceId = deviceId;
  if (!config.adminPasskey) {
    config.adminPasskey = expectedPasskey;
  }
  writeConfig(config);

  res.json({ success: true, token: expectedPasskey });
});

// Admin login (restricted to the activated device)
app.post("/api/admin/login", (req, res) => {
  const { passkey, deviceId } = req.body;
  const config = readConfig();

  if (!config.isActivated || !config.activatedDeviceId) {
    return res.status(400).json({ error: "Application is not activated yet." });
  }

  if (deviceId !== config.activatedDeviceId) {
    return res.status(403).json({ error: "Access denied. Bound to another device." });
  }

  const expectedPasskey = getAdminPasskey();
  if (passkey === expectedPasskey) {
    res.json({ success: true, token: expectedPasskey });
  } else {
    res.status(401).json({ error: "Invalid passkey." });
  }
});

// Get design configurations
app.get("/api/design", (req, res) => {
  const design = readDesign();
  res.json(design);
});

// Save design configurations (protected)
app.post("/api/design", adminAuthMiddleware, (req, res) => {
  const design = req.body;
  if (design && typeof design === "object") {
    writeDesign(design);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Invalid design data." });
  }
});

// Get guest list (admin-only? No, client RSVP needs it to perform search)
app.get("/api/guests", (req, res) => {
  res.json(readGuests());
});

// Save entire guest roster (protected)
app.post("/api/guests", adminAuthMiddleware, (req, res) => {
  const guests = req.body;
  if (Array.isArray(guests)) {
    writeGuests(guests);
    res.json({ success: true, count: guests.length });
  } else {
    res.status(400).json({ error: "Invalid guest database structure" });
  }
});

// Bind guest link to a device ID
app.post("/api/guest/bind", (req, res) => {
  const { guestId, deviceId } = req.body;
  if (!guestId || !deviceId) {
    return res.status(400).json({ error: "guestId and deviceId are required." });
  }

  const guests = readGuests();
  const guestIndex = guests.findIndex((g: any) => g.id === guestId);

  if (guestIndex === -1) {
    return res.status(404).json({ error: "Guest not found." });
  }

  const guest = guests[guestIndex];
  if (guest.boundDeviceId && guest.boundDeviceId !== deviceId) {
    return res.status(400).json({ error: "Guest link is already bound to another device." });
  }

  // Bind it
  guest.boundDeviceId = deviceId;
  writeGuests(guests);

  res.json({ success: true, guest });
});

// Public RSVP updates for guests (merges RSVP status only)
app.post("/api/rsvp", (req, res) => {
  const rsvpUpdates = req.body;
  const deviceId = req.headers["x-device-id"] as string;

  if (!Array.isArray(rsvpUpdates)) {
    return res.status(400).json({ error: "Invalid RSVP data. Must be an array." });
  }

  if (!deviceId) {
    return res.status(400).json({ error: "Device identifier is required." });
  }

  const guests = readGuests();
  let updatedCount = 0;

  // Verify bindings before saving
  for (const update of rsvpUpdates) {
    const matchingGuest = guests.find((g: any) => g.id === update.id);
    if (matchingGuest && matchingGuest.boundDeviceId && matchingGuest.boundDeviceId !== deviceId) {
      return res.status(403).json({ error: `Access denied. Guest ${matchingGuest.name} is bound to another device.` });
    }
  }

  const updatedRoster = guests.map((g: any) => {
    const matchingUpdate = rsvpUpdates.find((u: any) => u.id === g.id);
    if (matchingUpdate) {
      updatedCount++;
      return {
        ...g,
        isAttending: matchingUpdate.isAttending,
        mealSelection: matchingUpdate.mealSelection || "",
        dietaryRestrictions: matchingUpdate.dietaryRestrictions || "",
        plusOneName: matchingUpdate.plusOneName || "",
        songRequest: matchingUpdate.songRequest || "",
        lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }
    return g;
  });

  writeGuests(updatedRoster);
  res.json({ success: true, count: updatedCount });
});

// Proxy route for Google Sheets to completely bypass CORS issues
app.post("/api/sheets/proxy", async (req, res) => {
  const { url, payload } = req.body;
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Invalid Google Sheets URL" });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.json({ status: "success", info: "Webhook successfully invoked (raw status ok)" });
    }
  } catch (error: any) {
    console.error("Sheets proxy execution failure:", error);
    res.status(500).json({ error: error.message || "Failed to contact Google Sheet script" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
