import React, { useState } from "react";
import { Search, Heart, Music, Sparkles, ChefHat, UserCheck, AlertCircle, RefreshCw, Calendar, MapPin, Lock } from "lucide-react";
import { Guest, CoupleDesign } from "../types";
import DesignEnvelopeBorder from "./DesignEnvelopeBorder";

interface GuestRSVPProps {
  guests: Guest[];
  setGuests: React.Dispatch<React.SetStateAction<Guest[]>>;
  design: CoupleDesign;
  onAddToast: (text: string, type: "success" | "error" | "info" | "warning") => void;
  deviceId: string;
}

export default function GuestRSVP({ guests, setGuests, design, onAddToast, deviceId }: GuestRSVPProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [rsvpState, setRsvpState] = useState<Guest[]>([]);
  const [plusOneToggles, setPlusOneToggles] = useState<{ [guestId: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState(false);
  const [isGuestLockout, setIsGuestLockout] = useState(false);

  // Landing page state for Invitation
  const [showRSVPForm, setShowRSVPForm] = useState(false);

  // Split custom meal options
  const mealOptionsArray = design.mealOptions
    ? design.mealOptions.split(",").map((s) => s.trim()).filter(Boolean)
    : ["Filet Mignon", "King Salmon", "Mushroom Gnocchi (V)", "Kids Mac & Cheese"];

  // Read URL query parameters to support customized invitation pre-match
  const hasInitializedFromUrl = React.useRef(false);

  React.useEffect(() => {
    if (hasInitializedFromUrl.current || guests.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const guestParam = params.get("guest") || params.get("g");
    
    let match = null;
    if (guestParam) {
      const query = guestParam.trim().toLowerCase();
      match = guests.find((g) => g.name.toLowerCase().includes(query));
    }
    
    // Fallback to the first guest if no URL match is found, so we never show the search page
    if (!match && guests.length > 0) {
      match = guests[0];
    }

    if (match) {
      hasInitializedFromUrl.current = true;

      // Check guest link device binding lock
      if (match.boundDeviceId && match.boundDeviceId !== deviceId) {
        setIsGuestLockout(true);
        return;
      }

      // If guest link is not bound yet, automatically bind it to this device on the server
      if (!match.boundDeviceId && guestParam) {
        fetch("/api/guest/bind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestId: match.id, deviceId })
        })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            // Update client guests roster state
            setGuests((prev) => prev.map((g) => g.id === match.id ? { ...g, boundDeviceId: deviceId } : g));
          }
        })
        .catch((err) => console.error("Error binding guest device:", err));
      }

      const householdMembers = guests.filter((g) => g.householdId === match.householdId);
      setActiveHouseholdId(match.householdId);
      setRsvpState(JSON.parse(JSON.stringify(householdMembers)));

      const toggles: { [key: string]: boolean } = {};
      householdMembers.forEach((m) => {
        toggles[m.id] = !!m.plusOneName;
      });
      setPlusOneToggles(toggles);
      
      if (guestParam) {
        // Notify of personalized invite match under-the-hood
        onAddToast(`Personal invitation linked for ${match.name}! Click 'RSVP' to complete.`, "info");
      }
    }
  }, [guests, deviceId]);

  // Synchronize master guest changes immediately to the local active rsvpState
  React.useEffect(() => {
    if (activeHouseholdId && guests.length > 0) {
      const householdMembers = guests.filter((g) => g.householdId === activeHouseholdId);
      setRsvpState((prev) =>
        prev.map((prevGuest) => {
          const matchingMaster = householdMembers.find((m) => m.id === prevGuest.id);
          if (matchingMaster) {
            return {
              ...prevGuest,
              name: matchingMaster.name,
              householdName: matchingMaster.householdName,
              householdId: matchingMaster.householdId,
              hasPlusOneAllowed: matchingMaster.hasPlusOneAllowed,
              boundDeviceId: matchingMaster.boundDeviceId,
            };
          }
          return prevGuest;
        })
      );
    }
  }, [guests, activeHouseholdId]);

  if (isGuestLockout) {
    return (
      <div className="max-w-xl mx-auto py-2 animate-fade-in text-center font-sans">
        <DesignEnvelopeBorder design={design} className="p-8 md:p-12 relative overflow-hidden">
          <div className="mb-6 flex flex-col items-center">
            <span 
              className="inline-flex w-16 h-16 rounded-full items-center justify-center bg-rose-50 border border-rose-100 text-rose-600 mb-4"
              style={{ color: '#e11d48' }}
            >
              <Lock className="w-8 h-8" />
            </span>
            <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-wide">
              Invitation Link Locked
            </h2>
            <p className="text-stone-500 text-xs mt-2 leading-relaxed max-w-sm mx-auto">
              This personalized invitation link is secure and has already been activated on another computer or phone.
            </p>
          </div>

          <div className="p-4 bg-stone-50/80 border border-stone-200 rounded-2xl text-[11px] text-stone-600 leading-relaxed max-w-sm mx-auto">
            To view this invitation, you must open it on the original device where it was first opened. If you believe this is an error, please contact the couple to clear the device lock.
          </div>
        </DesignEnvelopeBorder>
      </div>
    );
  }

  // Phase A: Search look up
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      onAddToast("Please enter your name to find your invitation.", "warning");
      return;
    }

    // Attempt fuzzy match on full names
    const match = guests.find((g) => g.name.toLowerCase().includes(query));

    if (match) {
      // Find all household members
      const householdMembers = guests.filter((g) => g.householdId === match.householdId);
      setActiveHouseholdId(match.householdId);
      
      // Load current values or copy from master list
      setRsvpState(JSON.parse(JSON.stringify(householdMembers)));
      
      // Initialize plus-one toggle state
      const toggles: { [key: string]: boolean } = {};
      householdMembers.forEach((m) => {
        toggles[m.id] = !!m.plusOneName;
      });
      setPlusOneToggles(toggles);
      
      onAddToast(`Found invitation for the ${match.householdName}!`, "success");
    } else {
      onAddToast("We couldn't find an invitation matching that name. Double check spelling or search for your surname.", "error");
    }
  };

  // Update response state fields
  const updateGuestStatus = (guestId: string, isAttending: boolean) => {
    setRsvpState((prev) =>
      prev.map((g) =>
        g.id === guestId
          ? {
              ...g,
              isAttending,
              // If declining, reset details
              mealSelection: isAttending ? g.mealSelection || (mealOptionsArray[0] || "") : "",
              dietaryRestrictions: isAttending ? g.dietaryRestrictions : "",
              plusOneName: isAttending ? g.plusOneName : "",
            }
          : g
      )
    );
  };

  const updateGuestDetail = (guestId: string, field: keyof Guest, value: any) => {
    setRsvpState((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, [field]: value } : g))
    );
  };

  // Phase D: Send back to storage and backup on Google sheets
  const handleSubmitRSVP = async () => {
    // Basic verification: insure all members have a chosen RSVP status
    const unselected = rsvpState.filter((g) => g.isAttending === null);
    if (unselected.length > 0) {
      onAddToast(`Please select response status for everyone in your household.`, "warning");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Locally save state updates to global guest roster
      const updatedRoster = guests.map((g) => {
        const matchingUpdate = rsvpState.find((u) => u.id === g.id);
        if (matchingUpdate) {
          return {
            ...matchingUpdate,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        }
        return g;
      });

      setGuests(updatedRoster);
      localStorage.setItem("wedding_guest_list", JSON.stringify(updatedRoster));

      // Backup on full-stack Express database
      try {
        await fetch("/api/rsvp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-ID": deviceId
          },
          body: JSON.stringify(rsvpState),
        });
      } catch (srvErr) {
        console.warn("Express server backup warning:", srvErr);
      }

      // 2. Submit to Google Sheets (routed via Node.js server proxy to completely bypass CORS)
      if (design.googleSheetsUrl && design.googleSheetsUrl.startsWith("http")) {
        onAddToast("Saving locally... synchronizing with cloud sheets...", "info");
        try {
          const res = await fetch("/api/sheets/proxy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: design.googleSheetsUrl,
              payload: rsvpState,
            }),
          });

          if (!res.ok) {
            throw new Error(`Server returned status ${res.status}`);
          }

          const sheetsRes = await res.json();
          if (sheetsRes.status === "success" || sheetsRes.info !== undefined) {
            onAddToast("Google Sheets synchronization completed!", "success");
          } else {
            console.warn("Sheets response status warning:", sheetsRes);
            onAddToast("RSVP logged. Cloud backup reported warning (could be duplicate protection rules).", "info");
          }
        } catch (sheetsErr) {
          console.error("Sheets connection issue:", sheetsErr);
          onAddToast("RSVP saved. Google Sheets backup reported an access issue, please verify credentials.", "warning");
        }
      } else {
        onAddToast("RSVP saved securely on wedding database!", "success");
      }

      setSubmissionCompleted(true);
    } catch (err) {
      onAddToast("Could not submit RSVP. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSearchQuery("");
    setActiveHouseholdId(null);
    setRsvpState([]);
    setSubmissionCompleted(false);
    setShowRSVPForm(false);
  };

  return (
    <div className="w-full">
      {!showRSVPForm ? (
        /* Dynamic Wedding Invitation Landing Screen */
        <div className="max-w-xl mx-auto py-2 animate-fade-in text-center">
          <DesignEnvelopeBorder design={design} className="p-6 md:p-10 relative overflow-hidden">
            {/* Beautiful Custom / Preset Banner Cover Photo */}
            {design.bannerUrl && (
              <div className="w-full h-44 md:h-52 rounded-2xl overflow-hidden mb-6 shadow-md border border-stone-200/50 relative">
                <img 
                  src={design.bannerUrl} 
                  alt="Wedding Celebration Cover" 
                  className="w-full h-full object-cover transition-all duration-700 hover:scale-[1.03]"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/15 via-transparent to-transparent pointer-events-none" />
              </div>
            )}

            {/* Elegant floral illustration watermarked background or decorative divider */}
            <div className="mb-5">
              <span 
                className="inline-flex w-12 h-12 rounded-full items-center justify-center font-serif text-lg italic border" 
                style={{ borderColor: design.accentColor, color: design.primaryColor }}
              >
                {design.coupleNames.split("&").map(n => n.trim()[0]).join("")}
              </span>
              <div 
                className="mt-4 tracking-[0.2em] font-serif text-lg md:text-xl uppercase font-bold block"
                style={{ color: design.primaryColor }}
              >
                INVITATION
              </div>
            </div>

            <h3 className="font-serif tracking-widest text-xs uppercase opacity-75 mb-4 text-stone-500 font-bold">
              The Marriage Celebration of
            </h3>
            
            <h2 
              className="font-serif text-4xl md:text-5xl tracking-wide leading-tight mb-4"
              style={{ color: design.primaryColor }}
            >
              {design.coupleNames}
            </h2>

            {/* Custom invitee names greeting */}
            <div className="my-5 py-2.5 px-4 bg-stone-50/80 border border-stone-200/50 rounded-2xl max-w-sm mx-auto animate-fade-in">
              <span className="text-[9px] font-mono tracking-widest uppercase text-stone-400 block mb-0.5">Honored Guest(s)</span>
              <p 
                className="font-serif text-sm md:text-base font-semibold italic text-stone-850"
                style={{ color: design.primaryColor }}
              >
                {(() => {
                  const params = new URLSearchParams(window.location.search);
                  const hasGuestQuery = params.has("guest") || params.has("g");
                  return hasGuestQuery && rsvpState && rsvpState.length > 0 
                    ? rsvpState.map(g => g.name).join(" & ") 
                    : design.inviteeNames || "Our Cherished Family & Friends";
                })()}
              </p>
            </div>

            {/* Custom customizable welcome message */}
            <p className="font-serif italic text-stone-600 text-base md:text-lg leading-relaxed max-w-md mx-auto mb-8 whitespace-pre-line px-2">
              "{design.invitationWelcome}"
            </p>

            {/* Event Overview detail cards */}
            <div className="bg-stone-50/70 border border-stone-200/60 rounded-2xl p-5 mb-8 text-left space-y-3.5 max-w-sm mx-auto">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 mt-0.5 text-stone-500" style={{ color: design.accentColor }} />
                <div>
                  <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-widest font-mono">When</h4>
                  <p className="text-stone-600 text-xs mt-1">{design.weddingDate}</p>
                </div>
              </div>

              <div className="h-px bg-stone-200/50" />

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-stone-500" style={{ color: design.accentColor }} />
                <div>
                  <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-widest font-mono">Where (Hotel)</h4>
                  <p className="text-stone-600 text-xs mt-1">{design.weddingVenue}</p>
                  {design.weddingHall && (
                    <p className="text-[11px] font-sans text-stone-500 mt-1 italic">
                      Hall: {design.weddingHall}
                    </p>
                  )}
                </div>
              </div>

              <div className="h-px bg-stone-200/50" />

              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 mt-0.5 text-stone-500 animate-pulse" style={{ color: design.accentColor }} />
                <div>
                  <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-widest font-mono">RSVP Deadline</h4>
                  <p className="text-stone-700 text-xs font-bold mt-1">Please respond before {design.rsvpDeadline}</p>
                </div>
              </div>
            </div>

            {/* The beautiful RSVP button */}
            <button
              onClick={() => {
                setShowRSVPForm(true);
                onAddToast("Opening RSVP Form Portal...", "info");
              }}
              id="btn-rsvp-landing"
              className="px-10 py-4 font-sans font-semibold text-sm text-white rounded-xl shadow-lg hover:opacity-95 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 inline-flex items-center gap-2"
              style={{ backgroundColor: design.primaryColor }}
            >
              <Heart className="w-4 h-4 fill-white hover:animate-ping" />
              RSVP
            </button>
          </DesignEnvelopeBorder>
        </div>
      ) : submissionCompleted ? (
        /* RSVP Submission Completed Screen */
        <div className="max-w-xl mx-auto py-4 animate-fade-in">
          <DesignEnvelopeBorder design={design} className="p-10 text-center">
            <span
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-6"
              style={{ backgroundColor: `${design.primaryColor}15`, color: design.primaryColor }}
            >
              <Sparkles className="w-7 h-7" />
            </span>
            <h2 className="text-3xl font-serif text-stone-900 tracking-wide mb-3">Joyfully Submitted!</h2>
            <p className="text-stone-600 font-sans max-w-sm mx-auto mb-8 text-sm leading-relaxed">
              We have matched your replies in our registry. Your responses are saved securely, and we cannot wait to celebrate our union with you!
            </p>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-left mb-8 space-y-4">
              <p className="text-xs font-mono uppercase tracking-widest text-stone-400">
                Summary of Responses
              </p>
              {rsvpState.map((m) => (
                <div key={m.id} className="flex justify-between items-start border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <h4 className="font-sans font-semibold text-stone-800 text-sm">{m.name}</h4>
                    {m.isAttending ? (
                      <p className="text-xs text-stone-500 mt-1">
                        {design.enableMealSelection && `Meal: ${m.mealSelection}`}
                        {design.enableSongRequests && m.songRequest && ` • Song: ${m.songRequest}`}
                        {design.enablePlusOnesGlobally && m.plusOneName ? ` • Guest: ${m.plusOneName}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-stone-400 mt-1 font-serif italic">Regretfully Declining</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-sans font-medium ${
                      m.isAttending
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {m.isAttending ? "Attending" : "Declined"}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleReset}
              className="px-6 py-3 border border-stone-300 hover:bg-stone-50 rounded-xl font-sans text-stone-700 text-sm transition font-medium flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              RSVP another Guest Unit
            </button>
          </DesignEnvelopeBorder>
        </div>
      ) : (
        /* The RSVP Form Page */
        <div className="max-w-2xl mx-auto py-2 animate-fade-in">
          <div className="flex justify-between items-center mb-4 px-2">
            <button
              onClick={handleReset}
              className="text-stone-500 hover:text-stone-800 transition font-sans text-xs flex items-center gap-1.5"
            >
              &larr; Back to Invitation Card
            </button>
            {activeHouseholdId && (
              <span className="text-xs font-serif text-stone-500 bg-white border border-stone-200 px-3 py-1 rounded-full shadow-sm">
                Party: {rsvpState[0]?.householdName || "Response Group"}
              </span>
            )}
          </div>

          <DesignEnvelopeBorder design={design} className="p-6 md:p-8">
            <div className="border-b border-stone-200 pb-5 mb-6 text-left">
              <h2 className="text-2xl font-serif text-stone-900">Your RSVP Form</h2>
              <p className="text-stone-500 text-xs font-sans mt-1">
                Please choose joyfully accepting or declining and configure options for everyone in your party.
              </p>
            </div>

            {/* The dynamic active list of form inputs and questions */}
            <div className="animate-fade-in">
              <div className="space-y-6 mb-8 text-left">
                {rsvpState.map((guest, idx) => (
                  <div
                    key={guest.id}
                    className="bg-white border border-stone-100 rounded-2xl shadow-sm hover:shadow-md transition duration-200 overflow-hidden"
                  >
                    {/* Card Section Header: Name and Attending Toggles */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/50 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-stone-300 font-medium">{String(idx + 1).padStart(2, '0')}.</span>
                        <h3 className="font-serif font-bold text-stone-900 text-lg">{guest.name}</h3>
                      </div>

                      {/* Attending State Selector buttons */}
                      <div className="flex rounded-xl p-1 bg-stone-200 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => updateGuestStatus(guest.id, true)}
                          className={`px-4 py-2 text-xs font-medium font-sans rounded-lg transition-all cursor-pointer ${
                            guest.isAttending === true
                              ? "shadow-sm text-white animate-pulse"
                              : "text-stone-600 hover:text-stone-900"
                          }`}
                          style={{
                            backgroundColor: guest.isAttending === true ? design.primaryColor : undefined,
                          }}
                        >
                          Accepts with Joy
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGuestStatus(guest.id, false)}
                          className={`px-4 py-2 text-xs font-medium font-sans rounded-lg transition-all cursor-pointer ${
                            guest.isAttending === false
                              ? "shadow-sm text-white bg-rose-600"
                              : "text-stone-600 hover:text-stone-900"
                          }`}
                        >
                          Declines with Regret
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Form Sections for Attending Guests */}
                    {guest.isAttending === true && (
                      <div className="p-5 space-y-4 bg-white animate-fade-in text-left">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Meal selection */}
                          {design.enableMealSelection ? (
                            <div>
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                                <ChefHat className="w-3.5 h-3.5 text-stone-500" />
                                Entrée Course Selection
                              </label>
                              <select
                                value={guest.mealSelection || (mealOptionsArray[0] || "")}
                                onChange={(e) => updateGuestDetail(guest.id, "mealSelection", e.target.value)}
                                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-sans text-sm text-stone-800 focus:outline-none focus:ring-2"
                                style={{ "--tw-ring-color": design.primaryColor } as React.CSSProperties}
                              >
                                {mealOptionsArray.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}

                          {/* Dietary notes */}
                          {design.enableDietaryRestrictions ? (
                            <div>
                              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2 block">
                                Dietary Restrictions / Allergies
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Vegetarian, Gluten-Free, Nut Allergies"
                                value={guest.dietaryRestrictions}
                                onChange={(e) => updateGuestDetail(guest.id, "dietaryRestrictions", e.target.value)}
                                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-sans text-sm text-stone-800 focus:outline-none focus:ring-2"
                                style={{ "--tw-ring-color": design.primaryColor } as React.CSSProperties}
                              />
                            </div>
                          ) : null}
                        </div>

                        {/* Song lists */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          {design.enableSongRequests ? (
                            <div>
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                                <Music className="w-3.5 h-3.5 text-stone-400" />
                                Song Request on Dancefloor
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. September - Earth, Wind & Fire"
                                value={guest.songRequest}
                                onChange={(e) => updateGuestDetail(guest.id, "songRequest", e.target.value)}
                                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-sans text-sm text-stone-800 focus:outline-none"
                              />
                            </div>
                          ) : null}

                          {/* Plus one if allowed */}
                          {design.enablePlusOnesGlobally && guest.hasPlusOneAllowed ? (
                            <div className="space-y-2">
                              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                                Plus-One Access Granted
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`plusone-${guest.id}`}
                                  checked={plusOneToggles[guest.id] || false}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setPlusOneToggles(prev => ({ ...prev, [guest.id]: checked }));
                                    if (!checked) {
                                      updateGuestDetail(guest.id, "plusOneName", "");
                                    }
                                  }}
                                  className="rounded text-stone-600 focus:ring-stone-400 h-4 w-4"
                                />
                                <label htmlFor={`plusone-${guest.id}`} className="text-sm font-sans text-stone-600 cursor-pointer">
                                  Yes, I will bring a guest plus-one
                                </label>
                              </div>

                              {plusOneToggles[guest.id] && (
                                <input
                                  type="text"
                                  placeholder="Plus-One Guest Full Name"
                                  value={guest.plusOneName}
                                  onChange={(e) => updateGuestDetail(guest.id, "plusOneName", e.target.value)}
                                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-sans text-sm text-stone-800 focus:outline-none focus:ring-2 animate-slide-in"
                                  style={{ "--tw-ring-color": design.primaryColor } as React.CSSProperties}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-stone-50 rounded-xl border border-dotted border-stone-200 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-stone-500 leading-normal">
                                Single RSVP Ticket. If you have any additional queries regarding guests, reach out to Sophia or Alexander.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {guest.isAttending === false && (
                      <div className="p-6 bg-rose-50/20 text-center text-stone-500 font-serif italic text-sm border-t border-stone-50 animate-fade-in">
                        We will be raise a glass in spirit. Thank you for letting us know!
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center gap-4 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-3 border border-stone-200 hover:bg-stone-50 rounded-xl text-stone-500 text-sm font-medium transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSubmitRSVP}
                  disabled={isSubmitting}
                  className="py-3 px-8 font-sans font-medium text-white rounded-xl shadow-lg hover:opacity-95 transition-all text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: design.primaryColor }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving RSVP...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Submit RSVP Replies
                    </>
                  )}
                </button>
              </div>
            </div>
          </DesignEnvelopeBorder>
        </div>
      )}
    </div>
  );
}
