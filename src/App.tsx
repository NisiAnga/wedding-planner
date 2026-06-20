import React, { useState, useEffect } from "react";
import { 
  Heart, 
  Calendar, 
  MapPin, 
  Sparkles, 
  Settings, 
  Eye, 
  EyeOff, 
  Paintbrush, 
  Users, 
  FileText, 
  Check, 
  Plus, 
  Trash2,
  RefreshCw,
  Palette,
  Upload,
  FileSpreadsheet,
  Link2,
  Copy,
  ExternalLink,
  Lock,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { CoupleDesign, Guest } from "./types";
import { DEFAULT_DESIGN, INITIAL_GUESTS, COLOR_PRESETS, BANNER_PRESETS } from "./presets";
import Toast, { ToastMessage } from "./components/Toast";
import GuestRSVP from "./components/GuestRSVP";

export default function App() {
  const [deviceId] = useState(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("wedding_device_id");
    if (!id) {
      id = "dev_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem("wedding_device_id", id);
    }
    return id;
  });
  const [isActivated, setIsActivated] = useState(true);
  const [isDeviceAuthorized, setIsDeviceAuthorized] = useState(true);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(
    () => typeof window !== "undefined" && !!sessionStorage.getItem("admin_token")
  );
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [activationPasskeyInput, setActivationPasskeyInput] = useState("");

  // Determine if it was loaded or seed default
  const [design, setDesign] = useState<CoupleDesign>(() => {
    const saved = localStorage.getItem("wedding_couple_design");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_DESIGN;
  });

  const [guests, setGuests] = useState<Guest[]>(() => {
    const saved = localStorage.getItem("wedding_guest_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    // Seed standard mock guest database
    localStorage.setItem("wedding_guest_list", JSON.stringify(INITIAL_GUESTS));
    return INITIAL_GUESTS;
  });

  // Determine if URL query matches a guest invitation path (invitation-only mode)
  const isGuestView = typeof window !== "undefined" && !!(
    new URLSearchParams(window.location.search).has("g") ||
    new URLSearchParams(window.location.search).has("guest") ||
    new URLSearchParams(window.location.search).get("view") === "invitation"
  );

  // Layout mode controls
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"text" | "style" | "guests" | "sheets" | "settings">("text");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Google sheets action & syncing states
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [testResults, setTestResults] = useState<{ status: "idle" | "success" | "error"; msg: string }>({ status: "idle", msg: "" });
  const [copiedScript, setCopiedScript] = useState(false);

  // Synchronize customizer visibility with auth state
  useEffect(() => {
    if (isAdminAuthenticated && !isGuestView) {
      setShowCustomizer(true);
    } else {
      setShowCustomizer(false);
    }
  }, [isAdminAuthenticated, isGuestView]);

  // Load admin configuration status from server
  useEffect(() => {
    fetch(`/api/admin/status?deviceId=${encodeURIComponent(deviceId)}`)
      .then((res) => res.json())
      .then((data) => {
        setIsActivated(data.isActivated);
        setIsDeviceAuthorized(data.isDeviceAuthorized);
      })
      .catch((err) => console.error("Error loading admin status:", err));
  }, [deviceId]);

  // Load design dynamically from server
  useEffect(() => {
    fetch("/api/design")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("HTTP " + res.status);
      })
      .then((serverDesign) => {
        if (serverDesign && typeof serverDesign === "object") {
          setDesign(serverDesign);
          localStorage.setItem("wedding_couple_design", JSON.stringify(serverDesign));
        }
      })
      .catch((err) => {
        console.warn("Express server design query warning, using LocalStorage fallback:", err);
      });
  }, []);

  // Load guests dynamically from full-stack server
  useEffect(() => {
    fetch("/api/guests")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("HTTP " + res.status);
      })
      .then((serverGuests) => {
        if (Array.isArray(serverGuests) && serverGuests.length > 0) {
          setGuests(serverGuests);
          localStorage.setItem("wedding_guest_list", JSON.stringify(serverGuests));
        }
      })
      .catch((err) => {
        console.warn("Express server guest query warning, using LocalStorage fallback:", err);
      });
  }, []);

  // Save guests to server helper
  const saveGuestsToServer = async (updatedList: Guest[]) => {
    const token = sessionStorage.getItem("admin_token");
    if (!token) return;

    try {
      await fetch("/api/guests", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Device-ID": deviceId
        },
        body: JSON.stringify(updatedList),
      });
    } catch (err) {
      console.error("Local sync copy error:", err);
    }
  };

  // Save design to server helper
  const saveDesignToServer = async (updatedDesign: CoupleDesign) => {
    const token = sessionStorage.getItem("admin_token");
    if (!token) return;

    try {
      await fetch("/api/design", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Device-ID": deviceId
        },
        body: JSON.stringify(updatedDesign),
      });
    } catch (err) {
      console.error("Error saving design to server:", err);
    }
  };

  // Google Sheet Sync function for a single guest
  const syncGuestToGoogleSheets = async (guest: Guest, silent = false) => {
    if (!design.googleSheetsUrl || !design.googleSheetsUrl.startsWith("http")) {
      if (!silent) {
        addToast("Sheets Webhook URL is not configured. Go to 'Sheets' tab to add it.", "warning");
      }
      return false;
    }

    try {
      const base = window.location.origin + window.location.pathname;
      const guestLink = `${base}?g=${encodeURIComponent(guest.name)}`;
      const payload = {
        id: guest.id,
        name: guest.name,
        householdId: guest.householdId,
        householdName: guest.householdName,
        isAttending: guest.isAttending,
        mealSelection: guest.mealSelection || "Pending",
        dietaryRestrictions: guest.dietaryRestrictions || "None",
        plusOneName: guest.plusOneName || "N/A",
        songRequest: guest.songRequest || "None",
        invitationLink: guestLink
      };

      const res = await fetch("/api/sheets/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: design.googleSheetsUrl,
          payload: payload
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.status === "success" || data.info !== undefined) {
        if (!silent) {
          addToast(`Synced ${guest.name} row to Google Sheet!`, "success");
        }
        return true;
      } else {
        throw new Error(data.message || "Spreadsheet returned status error");
      }
    } catch (err: any) {
      console.error("Sheets sync warning:", err);
      if (!silent) {
        addToast(`Sheets Sync Failed: ${err.message || "Verify your connection settings"}`, "warning");
      }
      return false;
    }
  };

  // Link generator states
  const [showLinkGenerator, setShowLinkGenerator] = useState(false);
  const [generatorSearch, setGeneratorSearch] = useState("");

  // Guest adding form states
  const [newGuestName, setNewGuestName] = useState("");
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [newPlusOne, setNewPlusOne] = useState(false);

  // Custom color palettes state
  const [customPalettes, setCustomPalettes] = useState<any[]>(() => {
    const saved = localStorage.getItem("wedding_custom_palettes");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [customPaletteForm, setCustomPaletteForm] = useState({
    name: "",
    primary: "#5F7464",
    accent: "#B5A475",
    border: "#C2CBC4",
    canvas: "#F7F8F7"
  });

  const [dragActive, setDragActive] = useState(false);

  // Function to dynamically trigger notification items
  const addToast = (text: string, type: ToastMessage["type"] = "success") => {
    const id = `${Date.now()}_${Math.random()}`;
    const newToast: ToastMessage = { id, text, type };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Synchronize design changes immediately inside local persistence and server
  useEffect(() => {
    localStorage.setItem("wedding_couple_design", JSON.stringify(design));

    if (isAdminAuthenticated) {
      const timer = setTimeout(() => {
        saveDesignToServer(design);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [design, isAdminAuthenticated]);

  // Admin Setup / Auth event handlers
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput) return;

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: adminPasswordInput, deviceId }),
      });

      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("admin_token", data.token);
        setIsAdminAuthenticated(true);
        setShowLoginModal(false);
        setAdminPasswordInput("");
        addToast("Logged in successfully as Admin!", "success");
      } else {
        const data = await res.json();
        addToast(data.error || "Invalid passkey.", "error");
      }
    } catch (err) {
      addToast("Connection error. Could not login.", "error");
    }
  };

  const handleAdminActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationPasskeyInput.trim()) {
      addToast("Please enter the activation passkey.", "warning");
      return;
    }

    try {
      const res = await fetch("/api/admin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: activationPasskeyInput.trim(), deviceId }),
      });

      if (res.ok) {
        addToast("Application activated successfully and bound to this device!", "success");
        setIsActivated(true);
        setIsDeviceAuthorized(true);
        sessionStorage.setItem("admin_token", activationPasskeyInput.trim());
        setIsAdminAuthenticated(true);
        setActivationPasskeyInput("");
      } else {
        const data = await res.json();
        addToast(data.error || "Activation failed.", "error");
      }
    } catch (err) {
      addToast("Connection error during activation.", "error");
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem("admin_token");
    setIsAdminAuthenticated(false);
    setShowCustomizer(false);
    addToast("Logged out successfully.", "info");
  };

  // Handle specific design info edits
  const handleDesignChange = (field: keyof CoupleDesign, value: any) => {
    setDesign((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Drag-and-drop upload handlers for banner picture
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        addToast("Only image files are allowed.", "warning");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        addToast("Image is custom larger than 2MB. Please select a smaller photo for optimal performance.", "warning");
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleDesignChange("bannerUrl", event.target.result as string);
          addToast("Custom cover video/photo successfully applied!", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        addToast("Only image files are allowed.", "warning");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        addToast("Image is larger than 2MB. Please choose a smaller file.", "warning");
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleDesignChange("bannerUrl", event.target.result as string);
          addToast("Custom cover banner successfully updated with your photo!", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Create customized color palettes
  const handleCreateCustomPalette = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPaletteForm.name.trim()) {
      addToast("Please enter a name for your custom palette.", "warning");
      return;
    }
    const nameClean = customPaletteForm.name.trim();
    if (
      COLOR_PRESETS.some((p) => p.name.toLowerCase() === nameClean.toLowerCase()) ||
      customPalettes.some((p) => p.name.toLowerCase() === nameClean.toLowerCase())
    ) {
      addToast(`A palette with name "${nameClean}" already exists.`, "warning");
      return;
    }

    const newPal = {
      name: nameClean,
      primary: customPaletteForm.primary,
      accent: customPaletteForm.accent,
      border: customPaletteForm.border,
      canvas: customPaletteForm.canvas
    };

    const updated = [...customPalettes, newPal];
    setCustomPalettes(updated);
    localStorage.setItem("wedding_custom_palettes", JSON.stringify(updated));

    // Instantly apply this custom palette to our current design
    setDesign((prev) => ({
      ...prev,
      selectedPresetTheme: nameClean,
      primaryColor: newPal.primary,
      accentColor: newPal.accent,
      borderColor: newPal.border,
      canvasBg: newPal.canvas
    }));

    addToast(`Successfully saved and applied palette: ${nameClean}!`, "success");
    setCustomPaletteForm({
      name: "",
      primary: "#5F7464",
      accent: "#B5A475",
      border: "#C2CBC4",
      canvas: "#F7F8F7"
    });
  };

  const handleDeleteCustomPalette = (e: React.MouseEvent, palName: string) => {
    e.stopPropagation();
    const updated = customPalettes.filter((p) => p.name !== palName);
    setCustomPalettes(updated);
    localStorage.setItem("wedding_custom_palettes", JSON.stringify(updated));
    addToast(`Deleted custom palette: "${palName}".`, "info");
  };

  // Handle color preset selection
  const selectThemePreset = (presetName: string) => {
    // Check standard presets first
    let preset = COLOR_PRESETS.find((p) => p.name === presetName);
    // If not found, look at custom palettes
    if (!preset) {
      preset = customPalettes.find((p) => p.name === presetName);
    }

    if (preset) {
      setDesign((prev) => ({
        ...prev,
        selectedPresetTheme: preset.name,
        primaryColor: preset.primary,
        accentColor: preset.accent,
        borderColor: preset.border,
        canvasBg: preset.canvas,
      }));
      addToast(`Selected theme: ${preset.name}!`, "success");
    }
  };

  // Add guest manually
  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim() || !newHouseholdName.trim()) {
      addToast("Please fill in both the guest name and household name.", "warning");
      return;
    }

    const householdNameClean = newHouseholdName.trim();
    const existing = guests.find(
      (g) => g.householdName.toLowerCase() === householdNameClean.toLowerCase()
    );
    const householdId = existing ? existing.householdId : `h_${Date.now()}`;

    const newGuest: Guest = {
      id: `g_${Date.now()}`,
      name: newGuestName.trim(),
      householdId,
      householdName: householdNameClean,
      isAttending: null,
      mealSelection: "",
      dietaryRestrictions: "",
      hasPlusOneAllowed: newPlusOne,
      plusOneName: "",
      songRequest: ""
    };

    const updated = [...guests, newGuest];
    setGuests(updated);
    localStorage.setItem("wedding_guest_list", JSON.stringify(updated));
    saveGuestsToServer(updated);
    addToast(`${newGuest.name} added to party "${householdNameClean}"!`, "success");

    setNewGuestName("");
    setNewHouseholdName("");
    setNewPlusOne(false);
  };

  // Delete guest
  const handleDeleteGuest = (id: string, name: string) => {
    if (confirm(`Remove guest ${name}?`)) {
      const updated = guests.filter((g) => g.id !== id);
      setGuests(updated);
      localStorage.setItem("wedding_guest_list", JSON.stringify(updated));
      saveGuestsToServer(updated);
      addToast(`Removed ${name} from guest roster.`, "info");
    }
  };

  // KPI Calculations
  const totalInvited = guests.length;
  const acceptsCount = guests.filter((g) => g.isAttending === true).length;
  const declinesCount = guests.filter((g) => g.isAttending === false).length;
  const pendingCount = guests.filter((g) => g.isAttending === null).length;

  return (
    <div
      className="min-h-screen transition-colors duration-300 font-sans relative flex flex-col"
      style={{ backgroundColor: design.canvasBg }}
    >
      {/* Dynamic Background Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

      {/* Top Professional Design Toolbar */}
      {!isGuestView && (
        <header className="relative w-full bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 z-30 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow font-serif text-lg italic font-bold"
              style={{ backgroundColor: design.primaryColor }}
            >
              W
            </div>
            <div className="text-left">
              <h1 className="text-[15px] font-serif font-bold text-stone-900 tracking-wide flex items-center gap-1.5">
                Wedding Invitation Center <span className="text-[10px] bg-stone-100 border text-stone-500 font-mono px-2 py-0.5 rounded-full font-normal">v2.1</span>
              </h1>
              <p className="text-[10.5px] font-sans text-stone-500">Customize the design, configure options, and test the guest RSVP experience.</p>
            </div>
          </div>

          {/* Global Toolbar Controls */}
          <div className="flex items-center gap-3">
            {isAdminAuthenticated ? (
              <>
                <button
                  onClick={() => setShowCustomizer(!showCustomizer)}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 border border-stone-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer"
                >
                  {showCustomizer ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      Hide Customizer Sidebar
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Show Customizer Sidebar
                    </>
                  )}
                </button>
                <button
                  onClick={handleAdminLogout}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer animate-fade-in"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Logout Admin
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowLoginModal(true);
                }}
                type="button"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm cursor-pointer"
                style={{ backgroundColor: design.primaryColor }}
              >
                <Lock className="w-3.5 h-3.5" />
                {!isActivated ? "Activation Required" : "Admin Login"}
              </button>
            )}
          </div>
        </header>
      )}

      {/* Main Container: Split-screen Customizer or Centered preview */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row relative">
        
        {/* Left Side: Dynamic Customizer Sidebar Panel */}
        {showCustomizer && (
          <aside className="w-full lg:w-[410px] bg-white border-b lg:border-b-0 lg:border-r border-stone-200/80 flex flex-col z-20 h-auto lg:h-[calc(100vh-73px)] lg:sticky lg:top-[73px] overflow-hidden shadow-xs">
            {/* Sidebar navigation tabs */}
            <div className="flex border-b border-stone-100 bg-stone-50/50">
              <button
                type="button"
                onClick={() => setSidebarTab("text")}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  sidebarTab === "text"
                    ? "text-stone-900 border-stone-800 bg-white"
                    : "text-stone-500 hover:text-stone-900 border-transparent hover:bg-stone-50/50"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Text details
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("style")}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  sidebarTab === "style"
                    ? "text-stone-900 border-stone-800 bg-white"
                    : "text-stone-500 hover:text-stone-900 border-transparent hover:bg-stone-50/50"
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                Theming & colors
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("guests")}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  sidebarTab === "guests"
                    ? "text-stone-900 border-stone-800 bg-white"
                    : "text-stone-500 hover:text-stone-900 border-transparent hover:bg-stone-50/50"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Guests
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("sheets")}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  sidebarTab === "sheets"
                    ? "text-stone-900 border-stone-800 bg-white"
                    : "text-stone-500 hover:text-stone-900 border-transparent hover:bg-stone-50/50"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Sheets
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("settings")}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  sidebarTab === "settings"
                    ? "text-stone-900 border-stone-800 bg-white"
                    : "text-stone-500 hover:text-stone-900 border-transparent hover:bg-stone-50/50"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Config
              </button>
            </div>

            {/* Sidebar Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-stone-800">
              
              {/* TAB 1: INVITATION TEXT DETAILS */}
              {sidebarTab === "text" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div>
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono mb-1">Invitation Text Configuration</h3>
                    <p className="text-[11px] text-stone-500">Edit values below to instantly update the live invitation card on the right.</p>
                  </div>

                  <div className="space-y-3.5 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Couple Names</label>
                      <input
                        type="text"
                        value={design.coupleNames}
                        onChange={(e) => handleDesignChange("coupleNames", e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Default Invitee Names (Shown on Card)</label>
                      <input
                        type="text"
                        value={design.inviteeNames}
                        onChange={(e) => handleDesignChange("inviteeNames", e.target.value)}
                        placeholder="e.g. Our Cherished Family & Friends"
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Wedding Date</label>
                      <input
                        type="text"
                        value={design.weddingDate}
                        onChange={(e) => handleDesignChange("weddingDate", e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Venue Location (Hotel name)</label>
                      <input
                        type="text"
                        value={design.weddingVenue}
                        onChange={(e) => handleDesignChange("weddingVenue", e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Wedding Hall</label>
                      <input
                        type="text"
                        value={design.weddingHall || ""}
                        onChange={(e) => handleDesignChange("weddingHall", e.target.value)}
                        placeholder="e.g. Grand Terrace Hall"
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">RSVP Deadline</label>
                      <input
                        type="text"
                        value={design.rsvpDeadline}
                        onChange={(e) => handleDesignChange("rsvpDeadline", e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Welcome Message</label>
                      <textarea
                        value={design.invitationWelcome}
                        onChange={(e) => handleDesignChange("invitationWelcome", e.target.value)}
                        rows={3}
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-sans text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none leading-relaxed animate-fade-in"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: THEMING & BEAUTIFUL PALETTES */}
              {sidebarTab === "style" && (
                <div className="space-y-5 animate-fade-in text-left">
                  <div>
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono mb-1">Design Style & Colors</h3>
                    <p className="text-[11px] text-stone-500">Pick refined luxury styles calibrated by our design team.</p>
                  </div>

                  {/* Themes */}
                  <div className="space-y-2.5 text-left">
                    <label className="block text-xs font-semibold text-stone-700 hover:text-stone-900">Select Preset Theme</label>
                    <div className="grid grid-cols-2 gap-2">
                      {COLOR_PRESETS.map((p) => {
                        const isSelected = design.selectedPresetTheme === p.name || design.primaryColor === p.primary;
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => selectThemePreset(p.name)}
                            className={`p-2.5 border rounded-xl text-left transition text-xs flex flex-col gap-1.5 cursor-pointer hover:bg-stone-50 ${
                              isSelected ? "border-stone-800 bg-stone-50 font-semibold" : "border-stone-200 bg-white"
                            }`}
                          >
                            <span className="text-[11px] text-stone-850 truncate">{p.name}</span>
                            <div className="flex gap-1">
                              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.primary }} />
                              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.accent }} />
                              <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: p.canvas }} />
                            </div>
                          </button>
                        );
                      })}

                      {customPalettes.length > 0 && (
                        <div className="col-span-2 mt-2 pt-2 border-t border-stone-100">
                          <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest block mb-1">My Custom Palettes</span>
                        </div>
                      )}

                      {customPalettes.map((p) => {
                        const isSelected = design.selectedPresetTheme === p.name;
                        return (
                          <div
                            key={p.name}
                            onClick={() => selectThemePreset(p.name)}
                            className={`p-2.5 border rounded-xl text-left transition text-xs flex flex-col gap-1.5 cursor-pointer hover:bg-stone-50 relative group ${
                              isSelected ? "border-stone-800 bg-stone-50 font-semibold" : "border-stone-200 bg-white"
                            }`}
                          >
                            <span className="text-[11px] text-stone-850 truncate pr-5">{p.name}</span>
                            <div className="flex gap-1">
                              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.primary }} />
                              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.accent }} />
                              <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: p.canvas }} />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomPalette(e, p.name)}
                              className="absolute top-2 right-2 text-stone-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded-md hover:bg-stone-100"
                              title="Delete customized palette"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add Customized Palette Wizard */}
                  <form onSubmit={handleCreateCustomPalette} className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-3 text-left">
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-stone-605" style={{ color: design.primaryColor }} />
                      <span className="text-xs font-bold text-stone-800">Add Custom Palette Colors</span>
                    </div>
                    <span className="text-[11px] text-stone-500 block leading-tight">Create your own customized color combination.</span>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-mono text-stone-400 uppercase mb-1">Palette Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Blossom Orchid"
                          value={customPaletteForm.name}
                          onChange={(e) => setCustomPaletteForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-stone-400 uppercase mb-1">Primary Color</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={customPaletteForm.primary}
                              onChange={(e) => setCustomPaletteForm(prev => ({ ...prev, primary: e.target.value }))}
                              className="w-7 h-7 rounded border border-stone-300 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-stone-500 uppercase">{customPaletteForm.primary}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-stone-400 uppercase mb-1">Accent Details</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={customPaletteForm.accent}
                              onChange={(e) => setCustomPaletteForm(prev => ({ ...prev, accent: e.target.value }))}
                              className="w-7 h-7 rounded border border-stone-300 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-stone-500 uppercase">{customPaletteForm.accent}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-stone-400 uppercase mb-1">Borders</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={customPaletteForm.border}
                              onChange={(e) => setCustomPaletteForm(prev => ({ ...prev, border: e.target.value }))}
                              className="w-7 h-7 rounded border border-stone-300 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-stone-500 uppercase">{customPaletteForm.border}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-stone-400 uppercase mb-1">Page Canvas Bg</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={customPaletteForm.canvas}
                              onChange={(e) => setCustomPaletteForm(prev => ({ ...prev, canvas: e.target.value }))}
                              className="w-7 h-7 rounded border border-stone-300 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-stone-500 uppercase">{customPaletteForm.canvas}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-stone-900 text-white font-bold rounded-lg hover:bg-stone-800 text-center transition text-xs cursor-pointer"
                    >
                      + Save & Apply This Palette
                    </button>
                  </form>

                  {/* Manual Colors Fine-tune */}
                  <div className="space-y-3 bg-stone-50 p-3.5 border border-stone-200 rounded-xl text-left">
                    <span className="text-xs font-bold text-stone-705 block">Fine-tune Active Palette</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-stone-450 block mb-1">Primary Color</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={design.primaryColor}
                            onChange={(e) => handleDesignChange("primaryColor", e.target.value)}
                            className="w-8 h-8 rounded border border-stone-300 cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-stone-700 truncate uppercase">{design.primaryColor}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-stone-450 block mb-1">Accent Color</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={design.accentColor}
                            onChange={(e) => handleDesignChange("accentColor", e.target.value)}
                            className="w-8 h-8 rounded border border-stone-300 cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-stone-700 truncate uppercase">{design.accentColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Banner Photo Upload */}
                  <div className="space-y-3 bg-stone-50 p-3.5 border border-stone-200 rounded-xl text-left">
                    <label className="block text-xs font-bold text-stone-800">Cover Banner Image</label>
                    
                    {/* Drag and Drop Zone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                        dragActive 
                          ? "border-stone-800 bg-stone-200" 
                          : "border-stone-300 hover:border-stone-400 bg-white"
                      }`}
                    >
                      <input
                        type="file"
                        id="banner-file-upload"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label htmlFor="banner-file-upload" className="cursor-pointer block w-full h-full">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Upload className="w-5 h-5 text-stone-400 animate-pulse" style={{ color: design.primaryColor }} />
                          <span className="text-[11px] font-semibold text-stone-700">
                            Drag & drop your photo or <span className="text-stone-900 underline font-bold">browse files</span>
                          </span>
                          <span className="text-[9px] text-stone-400">
                            Fills the cover banner instantly (Max 2MB)
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Presets options */}
                    <div className="pt-2 border-t border-stone-200/50">
                      <span className="text-[10px] text-stone-400 block font-mono uppercase mb-1.5">Or Choose Classic Preset Cover</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {BANNER_PRESETS.map((b) => (
                          <button
                            key={b.name}
                            type="button"
                            onClick={() => handleDesignChange("bannerUrl", b.url)}
                            className={`relative border h-10 rounded-lg overflow-hidden transition cursor-pointer ${
                              design.bannerUrl === b.url ? "border-stone-800 scale-105 shadow-sm" : "border-stone-200 opacity-70 hover:opacity-100"
                            }`}
                            title={b.name}
                          >
                            <img src={b.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-stone-250 text-left">
                      <span className="text-[9px] font-mono text-stone-400 uppercase">Or Custom Banner Image URL</span>
                      <input
                        type="text"
                        value={design.bannerUrl}
                        onChange={(e) => handleDesignChange("bannerUrl", e.target.value)}
                        placeholder="https://images.unsplash.com/your-own-photo..."
                        className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs font-sans text-stone-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Border Frame */}
                  <div className="space-y-2 text-left">
                    <label className="block text-xs font-semibold text-stone-700">Border Accent Style</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {["Modern Rounded", "Double Classic", "Vintage Regal", "Top Accent Stripe"].map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => handleDesignChange("borderStyle", style)}
                          className={`p-2 border rounded-lg text-xs text-center transition cursor-pointer font-medium ${
                            design.borderStyle === style
                              ? "border-stone-800 bg-stone-50 text-stone-900 font-bold"
                              : "border-stone-200 bg-white hover:text-stone-850 text-stone-500"
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: GUEST LIST ROSTER */}
              {sidebarTab === "guests" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div>
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono mb-1">Invitee List Management</h3>
                    <p className="text-[11px] text-stone-500">Add or manage invitees below. Search by name to test custom mock RSVP workflows.</p>
                  </div>

                  {/* Fast counters */}
                  <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl border text-center">
                    <div>
                      <span className="text-[10px] text-stone-400 block font-bold">YES</span>
                      <span className="text-sm font-bold font-serif" style={{ color: design.primaryColor }}>{acceptsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block font-bold font-mono">MAYBE</span>
                      <span className="text-sm font-bold font-serif text-stone-500">{pendingCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block font-bold">NO</span>
                      <span className="text-sm font-bold font-serif text-stone-400">{declinesCount}</span>
                    </div>
                  </div>

                  {/* Add Guest Form */}
                  <form onSubmit={handleAddGuest} className="bg-stone-50/70 p-3.5 border border-stone-200 rounded-xl space-y-2.5 text-left">
                    <span className="text-xs font-bold text-stone-705 block">+ Add Invitee Household Unit</span>
                    
                    <div className="grid grid-cols-1 gap-2 text-left">
                      <input
                        type="text"
                        placeholder="Full Guest Name (e.g. John Doe)"
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        className="w-full p-2 bg-white border border-stone-250 rounded-lg text-xs font-sans text-stone-800"
                      />
                      <input
                        type="text"
                        placeholder="Household Grouping (e.g. Doe Party)"
                        value={newHouseholdName}
                        onChange={(e) => setNewHouseholdName(e.target.value)}
                        className="w-full p-2 bg-white border border-stone-250 rounded-lg text-xs font-sans text-stone-800"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 text-[10px] text-stone-605 font-semibold select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPlusOne}
                          onChange={(e) => setNewPlusOne(e.target.checked)}
                          className="rounded border-stone-300 text-stone-700 cursor-pointer"
                        />
                        Allow Plus-One Guest?
                      </label>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 text-[10px] font-bold text-white rounded-lg hover:opacity-90 cursor-pointer transition-all"
                        style={{ backgroundColor: design.primaryColor }}
                      >
                        Add Invitee
                      </button>
                    </div>
                  </form>

                  {/* Scrollable Guest Roster */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 text-left">
                    {guests.map((g) => (
                      <div key={g.id} className="p-2.5 bg-white border rounded-xl flex items-center justify-between text-xs hover:bg-stone-50/50">
                        <div className="text-left flex-1 min-w-0 mr-2 space-y-1">
                          <input
                            type="text"
                            value={g.name}
                            onChange={(e) => {
                              const updated = guests.map((item) => 
                                item.id === g.id ? { ...item, name: e.target.value } : item
                              );
                              setGuests(updated);
                              localStorage.setItem("wedding_guest_list", JSON.stringify(updated));
                              saveGuestsToServer(updated);
                            }}
                            className="font-semibold text-stone-850 bg-transparent border-b border-transparent hover:border-stone-250 focus:border-stone-450 focus:bg-stone-50/30 focus:outline-none w-full p-0.5 rounded transition text-xs"
                            title="Edit guest name"
                          />
                          <div className="flex items-center gap-1.5 text-[10px] text-stone-450">
                            <span className="text-stone-400">Unit:</span>
                            <input
                              type="text"
                              value={g.householdName}
                              onChange={(e) => {
                                const updated = guests.map((item) => 
                                  item.id === g.id ? { ...item, householdName: e.target.value } : item
                                );
                                setGuests(updated);
                                localStorage.setItem("wedding_guest_list", JSON.stringify(updated));
                                saveGuestsToServer(updated);
                              }}
                              className="bg-transparent border-b border-transparent hover:border-stone-250 focus:border-stone-450 focus:bg-stone-50/30 focus:outline-none p-0.5 rounded transition text-[10px] text-stone-500 font-medium"
                              title="Edit household name"
                            />
                            {g.hasPlusOneAllowed && <span className="flex-shrink-0 text-stone-400 font-normal">• +1 Allowed</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            g.isAttending === true 
                              ? "bg-green-50 text-green-700 border border-green-100" 
                              : g.isAttending === false 
                              ? "bg-red-50 text-red-700 border border-red-100" 
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}>
                            {g.isAttending === true ? "Accept" : g.isAttending === false ? "Decline" : "Pending"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteGuest(g.id, g.name)}
                            className="p-1 hover:text-red-600 text-stone-400 hover:text-stone-800 transition rounded-md duration-200 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: GOOGLE SHEETS SYNC INTEGRATION */}
              {sidebarTab === "sheets" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div>
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono mb-1">Google Sheets Sync</h3>
                    <p className="text-[11px] text-stone-500">Enable real-time, zero-friction cloud database logging of all guest RSVPs.</p>
                  </div>

                  {/* Settings section */}
                  <div className="space-y-3.5">
                    {/* Direct spreadsheet URL */}
                    <div className="space-y-1.5 bg-stone-50/70 p-3.5 border border-stone-200 rounded-xl">
                      <div className="flex items-center gap-1.5 text-stone-700">
                        <Link2 className="w-3.5 h-3.5 text-emerald-600 font-sans" />
                        <span className="text-xs font-bold">1. Google Spreadsheet Link</span>
                      </div>
                      <span className="text-[9.5px] text-stone-400 block leading-normal">
                        Your direct wedding spreadsheet address. We will open this link when reviewing entries.
                      </span>
                      <input
                        type="text"
                        value={design.spreadSheetUrl || ""}
                        onChange={(e) => handleDesignChange("spreadSheetUrl", e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                        className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs font-sans text-stone-800 focus:outline-none"
                      />
                      {design.spreadSheetUrl && design.spreadSheetUrl.startsWith("http") && (
                        <button
                          type="button"
                          onClick={() => window.open(design.spreadSheetUrl, "_blank")}
                          className="mt-1 pb-0.5 text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 transition cursor-pointer hover:underline"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Open linked Google Spreadsheet in fresh tab
                        </button>
                      )}
                    </div>

                    {/* Apps Script Webapp Webhook URL */}
                    <div className="space-y-1.5 bg-stone-50/70 p-3.5 border border-stone-200 rounded-xl">
                      <div className="flex items-center gap-1.5 text-stone-700">
                        <Lock className="w-3.5 h-3.5 text-emerald-600 font-sans" />
                        <span className="text-xs font-bold">2. Deployed Webhook URL</span>
                      </div>
                      <span className="text-[9.5px] text-stone-400 block leading-normal">
                        The Google Apps Script Web App Endpoint. Crucial to allow guest devices to write data rows.
                      </span>
                      <input
                        type="text"
                        value={design.googleSheetsUrl || ""}
                        onChange={(e) => handleDesignChange("googleSheetsUrl", e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="w-full p-2 bg-white border border-stone-200 rounded-lg text-[11px] font-mono text-stone-800 focus:outline-none"
                      />
                    </div>

                    {/* Connection status diagnostics list */}
                    <div className="bg-stone-50/50 p-3 border border-stone-201 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block">Sync Dashboard Diagnostics</span>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex items-center gap-1.5 p-1 bg-white border border-stone-100 rounded-md">
                          <div className={`w-1.5 h-1.5 rounded-full ${design.spreadSheetUrl ? "bg-emerald-500" : "bg-stone-300"}`} />
                          <span className="text-stone-600 font-medium font-sans">Spreadsheet Link</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 bg-white border border-stone-100 rounded-md">
                          <div className={`w-1.5 h-1.5 rounded-full ${design.googleSheetsUrl ? "bg-emerald-500" : "bg-stone-300"}`} />
                          <span className="text-stone-600 font-medium font-sans">Webhook API URL</span>
                        </div>
                      </div>

                      {/* Connection tests */}
                      <div className="pt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          disabled={isTestingSheets || !design.googleSheetsUrl}
                          onClick={async () => {
                            setIsTestingSheets(true);
                            setTestResults({ status: "idle", msg: "Testing connection..." });
                            try {
                              const testPayload = {
                                id: "TEST_CONN_" + Date.now(),
                                name: "🔔 Happy Couple Connection Test",
                                householdId: "TEST",
                                householdName: "Test Household",
                                isAttending: true,
                                mealSelection: "Vanilla Cake",
                                dietaryRestrictions: "None",
                                plusOneName: "None",
                                songRequest: "Let's Get Loud",
                              };
                              const res = await fetch("/api/sheets/proxy", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  url: design.googleSheetsUrl,
                                  payload: testPayload,
                                }),
                              });
                              const data = await res.json();
                              if (data.status === "success" || data.info !== undefined) {
                                setTestResults({ status: "success", msg: "Connection working! Inserted Happy Couple test row." });
                                addToast("Google Sheet Webhook Connection Verified!", "success");
                              } else {
                                throw new Error(data.message || "Failed test response");
                              }
                            } catch (e: any) {
                              setTestResults({ status: "error", msg: "Failure: " + (e.message || "Endpoint unreachable") });
                              addToast("Spreadsheet webhook test failed.", "warning");
                            } finally {
                              setIsTestingSheets(false);
                            }
                          }}
                          className={`flex-1 py-1 px-2.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer font-sans ${
                            design.googleSheetsUrl
                              ? "bg-stone-800 border-stone-800 text-white hover:bg-stone-900"
                              : "bg-stone-150 border-stone-200 text-stone-400 cursor-not-allowed"
                          }`}
                        >
                          <RefreshCw className={`w-3 h-3 ${isTestingSheets ? "animate-spin" : ""}`} />
                          {isTestingSheets ? "Verifying..." : "Ping Webhook Test"}
                        </button>

                        <button
                          type="button"
                          disabled={!design.spreadSheetUrl}
                          onClick={() => {
                            if (design.spreadSheetUrl) window.open(design.spreadSheetUrl, "_blank");
                          }}
                          className={`flex-1 py-1 px-2.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer font-sans ${
                            design.spreadSheetUrl
                              ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-705"
                              : "bg-stone-150 border-stone-200 text-stone-400 cursor-not-allowed"
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open Document
                        </button>
                      </div>

                      {testResults.msg && (
                        <div className={`mt-1.5 p-2 rounded-lg border text-[9px] font-mono leading-normal h-auto ${
                          testResults.status === "success"
                            ? "bg-emerald-50/70 border-emerald-200 text-emerald-800 font-medium"
                            : testResults.status === "error"
                            ? "bg-red-50/70 border-red-200 text-red-800"
                            : "bg-stone-50 border-stone-200 text-stone-500 animate-pulse"
                        }`}>
                          {testResults.msg}
                        </div>
                      )}
                    </div>

                    {/* Bulk force synchronization options */}
                    <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl space-y-2 text-left">
                      <div className="flex items-center gap-1.5 animate-pulse">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-stone-800">Bulk Spreadsheet Sync</span>
                      </div>
                      <span className="text-[10px] text-stone-500 leading-normal block">
                        Bulk write your entire current RSVP database ({acceptsCount} Attending, {declinesCount} Declined, {pendingCount} Pending) directly into your spreadsheet table. This ensures your cloud entries match what you see on screen!
                      </span>
                      <button
                        type="button"
                        disabled={isSyncingAll || !design.googleSheetsUrl}
                        onClick={async () => {
                          setIsSyncingAll(true);
                          addToast("Initiating full database export sync to cloud...", "info");
                          try {
                            const responsesSync = guests.map((g) => {
                              const base = window.location.origin + window.location.pathname;
                              const guestLink = `${base}?g=${encodeURIComponent(g.name)}`;
                              return {
                                id: g.id,
                                name: g.name,
                                householdId: g.householdId,
                                householdName: g.householdName,
                                isAttending: g.isAttending,
                                mealSelection: g.mealSelection || "Pending",
                                dietaryRestrictions: g.dietaryRestrictions || "None",
                                plusOneName: g.plusOneName || "N/A",
                                songRequest: g.songRequest || "None",
                                invitationLink: guestLink,
                              };
                            });

                            const res = await fetch("/api/sheets/proxy", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                url: design.googleSheetsUrl,
                                payload: responsesSync,
                              }),
                            });

                            const data = await res.json();
                            if (data.status === "success" || data.info !== undefined) {
                              addToast("Full wedding roster synced completely to Google Sheets!", "success");
                            } else {
                              throw new Error(data.message || "Failed proxy upload feedback");
                            }
                          } catch (bulkErr: any) {
                            console.error(bulkErr);
                            addToast("Bulk write error: verify Apps Script Webapp is deployed and online.", "warning");
                          } finally {
                            setIsSyncingAll(false);
                          }
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-xs font-sans ${
                          design.googleSheetsUrl
                            ? "bg-emerald-605 border-transparent text-white hover:bg-emerald-700 bg-emerald-600"
                            : "bg-white border-stone-200 text-stone-400 cursor-not-allowed"
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin" : ""}`} />
                        {isSyncingAll ? "Synchronizing All..." : "Sync All Guests to Google Sheet"}
                      </button>
                    </div>

                    {/* How-To Copy Code Box */}
                    <div className="bg-stone-50 border border-stone-200 p-3.5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-700 uppercase tracking-wider">Apps Script Setup Code</span>
                        <button
                          type="button"
                          onClick={() => {
                            const templateCode = `// Google Sheets Apps Script Web Service For Wedding RSVP Synchronizer
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
       if (!guest) continue;
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
         guest.mealSelection || "Pending",
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
    
    // Return success
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
}`;
                            navigator.clipboard.writeText(templateCode);
                            setCopiedScript(true);
                            addToast("Apps Script code copied to Clipboard!", "success");
                            setTimeout(() => setCopiedScript(false), 2000);
                          }}
                          className="text-[10px] bg-white border border-stone-250 py-1 px-2 rounded-lg font-bold hover:bg-stone-50 hover:text-stone-900 transition flex items-center gap-1 cursor-pointer font-sans shadow-2xs"
                        >
                          <Copy className="w-3 h-3 text-emerald-600" />
                          {copiedScript ? "Copied!" : "Copy Code"}
                        </button>
                      </div>

                      <ol className="text-[10px] text-stone-500 leading-normal pl-4 list-decimal space-y-1 font-sans">
                        <li>Open your <strong>Google Sheet</strong>.</li>
                        <li>Click <strong>Extensions &gt; Apps Script</strong>.</li>
                        <li>Paste our customized sync engine code.</li>
                        <li>Click <strong>Deploy &gt; New deployment</strong>.</li>
                        <li>Type: <strong>Web App</strong> (Execute as: <strong>Me</strong>, access: <strong>Anyone</strong>).</li>
                        <li>Copy the generated Web App URL and paste it in #2 above!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: ADVANCED SETTINGS */}
              {sidebarTab === "settings" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div>
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono mb-1">RSVP Feature Configuration</h3>
                    <p className="text-[11px] text-stone-500">Configure what additional details are collected in your invitation RSVP form.</p>
                  </div>

                  <div className="space-y-3 bg-stone-50 p-3.5 border border-stone-200 rounded-xl text-left">
                    <label className="flex items-center justify-between select-none p-1 border-b pb-2 cursor-pointer">
                      <span className="text-xs font-semibold text-stone-705">1. Enable Meal Custom Selection</span>
                      <input
                        type="checkbox"
                        checked={!!design.enableMealSelection}
                        onChange={(e) => handleDesignChange("enableMealSelection", e.target.checked)}
                        className="rounded border-stone-300 text-stone-700 cursor-pointer"
                      />
                    </label>

                    {design.enableMealSelection && (
                      <div className="pt-1.5 space-y-1 text-left animate-fade-in">
                        <span className="text-[10px] font-mono text-stone-400 uppercase">Catering Entrées list (comma-separated):</span>
                        <textarea
                          rows={2}
                          value={design.mealOptions || ""}
                          onChange={(e) => handleDesignChange("mealOptions", e.target.value)}
                          placeholder="e.g. Filet Mignon, King Salmon, Gnocchi (V)"
                          className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs font-sans text-stone-800 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 bg-stone-50 p-3.5 border border-stone-200 rounded-xl text-left">
                    <label className="flex items-center justify-between select-none p-1 cursor-pointer">
                      <span className="text-xs font-semibold text-stone-750">2. Request Dietary Restrictions</span>
                      <input
                        type="checkbox"
                        checked={!!design.enableDietaryRestrictions}
                        onChange={(e) => handleDesignChange("enableDietaryRestrictions", e.target.checked)}
                        className="rounded border-stone-300 text-stone-700 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="space-y-3 bg-stone-50 p-3.5 border border-stone-200 rounded-xl text-left">
                    <label className="flex items-center justify-between select-none p-1 cursor-pointer">
                      <span className="text-xs font-semibold text-stone-750">3. Request Song Recommendations</span>
                      <input
                        type="checkbox"
                        checked={!!design.enableSongRequests}
                        onChange={(e) => handleDesignChange("enableSongRequests", e.target.checked)}
                        className="rounded border-stone-300 text-stone-700 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="space-y-3 bg-stone-50 p-3.5 border border-stone-200 rounded-xl text-left">
                    <label className="flex items-center justify-between select-none p-1 cursor-pointer">
                      <span className="text-xs font-semibold text-stone-750">4. Support Plus-Ones dynamically</span>
                      <input
                        type="checkbox"
                        checked={!!design.enablePlusOnesGlobally}
                        onChange={(e) => handleDesignChange("enablePlusOnesGlobally", e.target.checked)}
                        className="rounded border-stone-300 text-stone-700 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Google Sheets backup url */}
                  <div className="space-y-2 bg-stone-50 p-3.5 border border-stone-200 rounded-xl text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700">5. Google Sheets Sync URL</span>
                    </div>
                    <span className="text-[9px] text-stone-400 block leading-tight">Optionally back up responses row-by-row live in Google Sheets. Add Apps Script Web App url:</span>
                    <input
                      type="text"
                      value={design.googleSheetsUrl || ""}
                      onChange={(e) => handleDesignChange("googleSheetsUrl", e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-800"
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Sidebar Sticky Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
              <span>Auto-saving changes locally</span>
              <button
                type="button"
                onClick={() => {
                  setDesign(DEFAULT_DESIGN);
                  setGuests(INITIAL_GUESTS);
                  localStorage.removeItem("wedding_couple_design");
                  localStorage.removeItem("wedding_guest_list");
                  addToast("Reset to factory presets!", "info");
                }}
                className="text-stone-400 hover:text-stone-700 transition underline hover:no-underline cursor-pointer"
              >
                Reset Default Presets
              </button>
            </div>
          </aside>
        )}

        {/* Right Side / Center Content: Main Invitation viewport */}
        <main 
          className="flex-1 px-4 py-8 md:py-12 flex flex-col justify-start items-center relative"
          style={{ minHeight: isGuestView ? "100vh" : "calc(100vh - 73px)" }}
        >
          
          <div className="w-full max-w-xl animate-fade-in flex flex-col items-center">
            {/* The actual Invitation card view component */}
            <GuestRSVP
              guests={guests}
              setGuests={setGuests}
              design={design}
              onAddToast={addToast}
              deviceId={deviceId}
            />

            {/* "Generate the Invitation Link" Button outside the invitation box */}
            {!isGuestView && (
              <div id="link-generator-outer" className="mt-8 w-full animate-fade-in">
                <button
                  type="button"
                  id="btn-generate-invitations"
                  onClick={async () => {
                    const nextVal = !showLinkGenerator;
                    setShowLinkGenerator(nextVal);
                    if (nextVal) {
                      addToast("Unique invitation links active!", "success");
                      if (design.googleSheetsUrl) {
                        addToast("Google Sheets connected. Opening row data spreadsheet page...", "info");
                        
                        // Async background sync of all guest list item rows
                        let count = 0;
                        for (const g of guests) {
                          const synced = await syncGuestToGoogleSheets(g, true);
                          if (synced) count++;
                        }
                        if (count > 0) {
                          addToast(`Successfully synchronized ${count} invitee records to Google Sheet!`, "success");
                        }
                        
                        // Open the actual spreadsheet row container
                        if (design.spreadSheetUrl) {
                          setTimeout(() => {
                            window.open(design.spreadSheetUrl, "_blank");
                          }, 300);
                        }
                      }
                    }
                  }}
                  className="w-full py-3.5 px-6 font-sans font-bold text-stone-700 bg-white border border-stone-250 hover:bg-stone-50 rounded-2xl shadow-xs transition-all duration-200 inline-flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer font-sans"
                  style={{ borderColor: design.accentColor }}
                >
                  <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
                  {showLinkGenerator ? "Hide Link Generator" : "Generate Invitation Link"}
                </button>

                {showLinkGenerator && (
                  <div className="mt-4 bg-white border border-stone-200/80 rounded-2xl p-5 shadow-md text-left space-y-4 animate-slide-in">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-stone-900">Unique Guest Invitation Links</span>
                      <p className="text-[11px] text-stone-500 leading-normal">
                        Every guest has a dedicated link. When clicked, all planner customization sidebars are disabled, loading <strong>only the invitation</strong> personalized for them.
                      </p>
                    </div>

                    {/* Search inside generator */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search guests by name to copy..."
                        value={generatorSearch}
                        onChange={(e) => setGeneratorSearch(e.target.value)}
                        className="w-full p-2.5 pl-3 bg-stone-50/80 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-1"
                        style={{ "--tw-ring-color": design.primaryColor } as React.CSSProperties}
                      />
                    </div>

                    <div className="space-y-2.5 max-h-60 overflow-y-auto divide-y divide-stone-100 pr-1">
                      {guests
                        .filter((g) => g.name.toLowerCase().includes(generatorSearch.toLowerCase()))
                        .map((g) => {
                          const base = window.location.origin + window.location.pathname;
                          const guestLink = `${base}?g=${encodeURIComponent(g.name)}`;
                          return (
                            <div key={g.id} className="pt-3 pb-1 first:pt-0 flex items-center justify-between gap-3 text-xs">
                              <div className="truncate min-w-0 flex-1">
                                <span className="font-semibold text-stone-850 block">{g.name}</span>
                                <span className="text-[10px] text-stone-400 font-mono block truncate mt-0.5">{guestLink}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {design.googleSheetsUrl && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const success = await syncGuestToGoogleSheets(g);
                                      if (success && design.spreadSheetUrl) {
                                        setTimeout(() => {
                                          window.open(design.spreadSheetUrl, "_blank");
                                        }, 400);
                                      }
                                    }}
                                    className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer font-sans"
                                    title="Synch this guest RSVP data row and open Google Sheet"
                                  >
                                    <FileSpreadsheet className="w-3 h-3 text-emerald-600 animate-pulse" />
                                    Open Row
                                  </button>
                                )}
                                <a
                                  href={guestLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-605 border border-stone-200 rounded-lg text-[10.5px] font-semibold transition"
                                >
                                  Test View
                                </a>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    navigator.clipboard.writeText(guestLink);
                                    addToast(`Copied custom link for ${g.name}!`, "success");
                                    // Also run a silent background sync to ensure row is added / prepared
                                    if (design.googleSheetsUrl) {
                                      await syncGuestToGoogleSheets(g, true);
                                    }
                                  }}
                                  className="px-3 py-1.5 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer font-sans"
                                  style={{ backgroundColor: design.primaryColor }}
                                >
                                  Copy Link
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {guests.filter((g) => g.name.toLowerCase().includes(generatorSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-stone-400 italic text-center py-4">No matching guests found.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Footer credits */}
      <footer className="w-full py-6 mt-auto border-t border-stone-200 bg-white/70 text-center text-xs text-stone-400 z-10 font-sans">
        <p className="font-serif italic font-medium">Built with careful detail for {design.coupleNames}</p>
        <p className="mt-1 opacity-75">All preferences synchronize securely client-side.</p>
      </footer>

      {/* Floating active Toast notifications */}
      <Toast toasts={toasts} onClose={removeToast} />

      {/* Floating Admin Login trigger */}
      {!isAdminAuthenticated && !isGuestView && (
        <button
          onClick={() => {
            setShowLoginModal(true);
          }}
          className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-white hover:bg-stone-50 text-stone-605 border border-stone-200 flex items-center justify-center shadow-lg transition duration-200 z-45 active:scale-95 cursor-pointer hover:border-stone-400"
          style={{ color: design.primaryColor }}
          title="Admin Panel Login"
        >
          <Lock className="w-4 h-4" />
        </button>
      )}

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">
                <Lock className="w-5 h-5" style={{ color: design.primaryColor }} />
                Admin Authentication
              </h3>
              <button 
                type="button" 
                onClick={() => setShowLoginModal(false)}
                className="text-stone-400 hover:text-stone-700 font-semibold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Enter Admin Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 py-2.5 border border-stone-250 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-white rounded-xl text-xs font-semibold hover:opacity-95 cursor-pointer animate-pulse"
                  style={{ backgroundColor: design.primaryColor }}
                >
                  Unlock Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Locked Modal */}
      {showLoginModal && isActivated && !isDeviceAuthorized && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-650" style={{ color: '#dc2626' }} />
                Access Denied
              </h3>
              <button 
                type="button" 
                onClick={() => setShowLoginModal(false)}
                className="text-stone-400 hover:text-stone-700 font-semibold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 text-stone-600 text-xs leading-relaxed font-sans">
              <div className="flex gap-2 items-start p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">License Locked to Another Computer</span>
                  This passkey has already been activated on another computer. Administrative customization is restricted to that device.
                </div>
              </div>
              <p className="text-[11px] text-stone-500">
                To move the admin access to this computer, you must edit the server's configuration file or contact your system administrator to clear the active device binding.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="w-full py-2.5 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Admin Activation Modal */}
      {!isActivated && (
        <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="border-b pb-3">
              <h3 className="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600 animate-bounce" />
                Product Activation Required
              </h3>
              <p className="text-[11px] text-stone-500 mt-1">Please enter your unique Passkey to activate the customization dashboard. This will bind the admin tools to this computer.</p>
            </div>
            
            <form onSubmit={handleAdminActivation} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">Enter Activation Passkey</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={activationPasskeyInput}
                  onChange={(e) => setActivationPasskeyInput(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-2.5 text-white bg-stone-900 hover:bg-stone-850 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Activate & Bind Device
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
