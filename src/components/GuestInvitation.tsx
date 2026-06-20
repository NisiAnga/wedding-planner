import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, TextInput, Switch, Platform } from 'react-native';
import { Calendar, MapPin, Sparkles, Heart, Music, ChefHat, UserCheck, AlertCircle, RefreshCw, Lock } from 'lucide-react-native';
import { Guest, CoupleDesign } from '../types';
import { database } from '../lib/database';

interface GuestInvitationProps {
  guests: Guest[];
  onGuestsUpdate: (updated: Guest[]) => void;
  design: CoupleDesign;
  deviceId: string;
  guestNameQuery?: string;
  onClosePreview?: () => void;
}

export default function GuestInvitation({
  guests,
  onGuestsUpdate,
  design,
  deviceId,
  guestNameQuery,
  onClosePreview
}: GuestInvitationProps) {
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [rsvpState, setRsvpState] = useState<Guest[]>([]);
  const [plusOneToggles, setPlusOneToggles] = useState<{ [guestId: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState(false);
  const [isGuestLockout, setIsGuestLockout] = useState(false);
  const [showRSVPForm, setShowRSVPForm] = useState(false);

  // Split custom meal options
  const mealOptionsArray = design.mealOptions
    ? design.mealOptions.split(',').map((s) => s.trim()).filter(Boolean)
    : ["Filet Mignon", "King Salmon", "Mushroom Gnocchi (V)", "Kids Mac & Cheese"];

  // Initialize and match guest on mount or changes
  useEffect(() => {
    if (guests.length === 0) return;

    let match: Guest | null = null;
    if (guestNameQuery) {
      const query = guestNameQuery.trim().toLowerCase();
      match = guests.find((g) => g.name.toLowerCase().includes(query)) || null;
    }
    
    // General fallback: if no URL query match, default to first guest for rendering layout
    if (!match && guests.length > 0) {
      match = guests[0];
    }

    if (match) {
      // Check device lock status
      if (match.boundDeviceId && match.boundDeviceId !== deviceId) {
        setIsGuestLockout(true);
        return;
      }

      // Auto-bind guest to device ID on first visit if query was provided
      if (!match.boundDeviceId && guestNameQuery) {
        database.bindGuestDevice(match.id, deviceId).then((res) => {
          if (res.success) {
            onGuestsUpdate(
              guests.map((g) => g.id === match!.id ? { ...g, boundDeviceId: deviceId } : g)
            );
          }
        });
      }

      const householdMembers = guests.filter((g) => g.householdId === match!.householdId);
      setActiveHouseholdId(match.householdId);
      setRsvpState(JSON.parse(JSON.stringify(householdMembers)));

      const toggles: { [key: string]: boolean } = {};
      householdMembers.forEach((m) => {
        toggles[m.id] = !!m.plusOneName;
      });
      setPlusOneToggles(toggles);
    }
  }, [guests, guestNameQuery, deviceId]);

  const updateGuestStatus = (guestId: string, isAttending: boolean) => {
    setRsvpState((prev) =>
      prev.map((g) =>
        g.id === guestId
          ? {
              ...g,
              isAttending,
              mealSelection: isAttending ? g.mealSelection || (mealOptionsArray[0] || '') : '',
              dietaryRestrictions: isAttending ? g.dietaryRestrictions : '',
              plusOneName: isAttending ? g.plusOneName : '',
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

  const handleSubmitRSVP = async () => {
    const unselected = rsvpState.filter((g) => g.isAttending === null);
    if (unselected.length > 0) {
      alert('Please select accepts or declines status for everyone in your household party.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await database.updateGuestRSVPs(rsvpState, deviceId);
      if (res.success) {
        // Sync back to master
        const updatedMaster = guests.map((g) => {
          const match = rsvpState.find((u) => u.id === g.id);
          return match ? { ...match, lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : g;
        });
        onGuestsUpdate(updatedMaster);
        setSubmissionCompleted(true);
      } else {
        alert(res.error || 'Failed to submit RSVP.');
      }
    } catch {
      alert('Submission issue. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmissionCompleted(false);
    setShowRSVPForm(false);
  };

  // Lockout Screen
  if (isGuestLockout) {
    return (
      <View style={styles.container}>
        <View style={styles.envelopeBorder}>
          <View style={styles.lockoutContent}>
            <View style={styles.iconBlockedBg}>
              <Lock size={30} color="#E11D48" />
            </View>
            <Text style={styles.lockoutTitle}>Invitation Link Locked</Text>
            <Text style={styles.lockoutText}>
              This personalized invitation link is secure and has already been activated on another phone or computer.
            </Text>
            <View style={styles.lockoutFooter}>
              <Text style={styles.lockoutFooterText}>
                To view this invitation, please open it on the original device where it was first opened. If you believe this is an error, contact the couple to clear the device lock.
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // RSVP Form View
  if (showRSVPForm && !submissionCompleted) {
    return (
      <ScrollView contentContainerStyle={styles.scrollFormContainer}>
        {onClosePreview && (
          <TouchableOpacity style={styles.backBtn} onPress={onClosePreview}>
            <Text style={styles.backBtnText}>&larr; Back to Admin Dashboard</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.cardBackLink} onPress={handleReset}>
            <Text style={styles.cardBackLinkText}>&larr; Back to Card</Text>
          </TouchableOpacity>
          {rsvpState[0] && (
            <View style={styles.badgeParty}>
              <Text style={styles.badgePartyText}>Party: {rsvpState[0].householdName}</Text>
            </View>
          )}
        </View>

        <View style={[styles.envelopeBorder, { borderColor: design.borderColor }]}>
          <Text style={styles.formTitle}>Your RSVP Form</Text>
          <Text style={styles.formSub}>Please accept or decline and configure menu options for everyone in your party.</Text>
          <View style={styles.divider} />

          {rsvpState.map((guest, idx) => (
            <View key={guest.id} style={styles.guestCard}>
              <View style={styles.guestHeader}>
                <Text style={styles.guestNumber}>{String(idx + 1).padStart(2, '0')}.</Text>
                <Text style={styles.guestName}>{guest.name}</Text>
              </View>

              <View style={styles.toggleRow}>
                <TouchableOpacity 
                  style={[
                    styles.toggleBtn, 
                    guest.isAttending === true && { backgroundColor: design.primaryColor }
                  ]}
                  onPress={() => updateGuestStatus(guest.id, true)}
                >
                  <Text style={[styles.toggleBtnText, guest.isAttending === true && styles.textWhite]}>
                    Accepts with Joy
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.toggleBtn, 
                    guest.isAttending === false && styles.toggleBtnDeclined
                  ]}
                  onPress={() => updateGuestStatus(guest.id, false)}
                >
                  <Text style={[styles.toggleBtnText, guest.isAttending === false && styles.textWhite]}>
                    Declines
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Dynamic details for attending */}
              {guest.isAttending === true && (
                <View style={styles.guestDetails}>
                  {design.enableMealSelection && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.formLabel}>
                        <ChefHat size={12} color="#78716C" /> Entrée Selection
                      </Text>
                      <View style={styles.pickerWrapper}>
                        {mealOptionsArray.map((opt) => (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.mealChip,
                              guest.mealSelection === opt && { borderColor: design.primaryColor, backgroundColor: `${design.primaryColor}10` }
                            ]}
                            onPress={() => updateGuestDetail(guest.id, 'mealSelection', opt)}
                          >
                            <Text style={[styles.mealChipText, guest.mealSelection === opt && { color: design.primaryColor, fontWeight: '600' }]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {design.enableDietaryRestrictions && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.formLabel}>Dietary Notes / Allergies</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. Vegetarian, Nut Allergy"
                        value={guest.dietaryRestrictions}
                        onChangeText={(val) => updateGuestDetail(guest.id, 'dietaryRestrictions', val)}
                      />
                    </View>
                  )}

                  {design.enableSongRequests && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.formLabel}>
                        <Music size={12} color="#78716C" /> Dancefloor Song Request
                      </Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="e.g. September - Earth Wind & Fire"
                        value={guest.songRequest}
                        onChangeText={(val) => updateGuestDetail(guest.id, 'songRequest', val)}
                      />
                    </View>
                  )}

                  {design.enablePlusOnesGlobally && guest.hasPlusOneAllowed && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.formLabel}>Plus-One Access</Text>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchText}>I will bring a guest plus-one</Text>
                        <Switch
                          value={plusOneToggles[guest.id] || false}
                          onValueChange={(val) => {
                            setPlusOneToggles(prev => ({ ...prev, [guest.id]: val }));
                            if (!val) updateGuestDetail(guest.id, 'plusOneName', '');
                          }}
                        />
                      </View>
                      {plusOneToggles[guest.id] && (
                        <TextInput
                          style={styles.formInput}
                          placeholder="Plus-One Guest Full Name"
                          value={guest.plusOneName}
                          onChangeText={(val) => updateGuestDetail(guest.id, 'plusOneName', val)}
                        />
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity 
            disabled={isSubmitting}
            style={[styles.btnSubmitRSVP, { backgroundColor: design.primaryColor }]}
            onPress={handleSubmitRSVP}
          >
            <UserCheck size={18} color="#FFFFFF" />
            <Text style={styles.btnSubmitRSVPText}>
              {isSubmitting ? 'Saving Replies...' : 'Submit RSVP Replies'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Submission Completed View
  if (submissionCompleted) {
    return (
      <View style={styles.container}>
        <View style={styles.envelopeBorder}>
          <View style={styles.successCard}>
            <View style={[styles.successIconBg, { backgroundColor: `${design.primaryColor}15` }]}>
              <Sparkles size={36} color={design.primaryColor} />
            </View>
            <Text style={styles.successTitle}>Replies Received!</Text>
            <Text style={styles.successText}>
              Thank you for letting us know! Your preferences are locked in. We cannot wait to celebrate with you.
            </Text>

            <TouchableOpacity 
              style={styles.btnSecondary}
              onPress={handleReset}
            >
              <RefreshCw size={14} color="#57534E" />
              <Text style={styles.btnSecondaryText}>View invitation card</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // General Invitation Card landing page
  return (
    <ScrollView contentContainerStyle={styles.scrollCardContainer}>
      {onClosePreview && (
        <TouchableOpacity style={styles.backBtn} onPress={onClosePreview}>
          <Text style={styles.backBtnText}>&larr; Back to Admin Dashboard</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.envelopeBorder, { borderColor: design.borderColor, backgroundColor: design.canvasBg }]}>
        {design.bannerUrl ? (
          <Image 
            source={{ uri: design.bannerUrl }} 
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.cardHeader}>
          <View style={[styles.monogramBubble, { borderColor: design.accentColor }]}>
            <Text style={[styles.monogramText, { color: design.primaryColor }]}>
              {design.coupleNames.split('&').map(n => n.trim()[0]).join('')}
            </Text>
          </View>
          <Text style={[styles.invitationBadge, { color: design.primaryColor }]}>INVITATION</Text>
        </View>

        <Text style={styles.cardInviteHeading}>The Marriage Celebration of</Text>
        <Text style={[styles.coupleTitle, { color: design.primaryColor }]}>{design.coupleNames}</Text>

        <View style={styles.honoredGuestBox}>
          <Text style={styles.honoredLabel}>HONORED GUEST(S)</Text>
          <Text style={[styles.honoredNames, { color: design.primaryColor }]}>
            {(() => {
              const hasGuestQuery = !!guestNameQuery;
              return hasGuestQuery && rsvpState.length > 0
                ? rsvpState.map(g => g.name).join(' & ')
                : design.inviteeNames || 'Our Cherished Family & Friends';
            })()}
          </Text>
        </View>

        <Text style={styles.welcomeText}>"{design.invitationWelcome}"</Text>

        <View style={styles.detailBox}>
          <View style={styles.detailRow}>
            <Calendar size={16} color={design.accentColor} />
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>WHEN</Text>
              <Text style={styles.detailText}>{design.weddingDate}</Text>
            </View>
          </View>
          
          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <MapPin size={16} color={design.accentColor} />
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>WHERE</Text>
              <Text style={styles.detailText}>{design.weddingVenue}</Text>
              {design.weddingHall ? (
                <Text style={styles.detailHall}>Hall: {design.weddingHall}</Text>
              ) : null}
            </View>
          </View>
          
          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Sparkles size={16} color={design.accentColor} />
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>RSVP DEADLINE</Text>
              <Text style={styles.detailDeadline}>Please respond by {design.rsvpDeadline}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.btnRSVP, { backgroundColor: design.primaryColor }]}
          onPress={() => setShowRSVPForm(true)}
        >
          <Heart size={16} color="#FFFFFF" />
          <Text style={styles.btnRSVPText}>RSVP</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
  },
  scrollCardContainer: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollFormContainer: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#F5F5F7',
  },
  backBtn: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    maxWidth: 550,
    alignSelf: 'center',
  },
  cardBackLink: {
    padding: 4,
  },
  cardBackLinkText: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: '500',
  },
  badgeParty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E7E5E4',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgePartyText: {
    fontSize: 11,
    color: '#78716C',
    fontFamily: 'serif',
  },
  envelopeBorder: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 550,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  bannerImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 20,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  monogramBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  monogramText: {
    fontSize: 16,
    fontFamily: 'serif',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  invitationBadge: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  cardInviteHeading: {
    fontSize: 11,
    color: '#78716C',
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  coupleTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'serif',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 16,
  },
  honoredGuestBox: {
    backgroundColor: '#FAF9F6',
    borderColor: '#E7E5E4',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    alignSelf: 'center',
    width: '90%',
    marginBottom: 20,
  },
  honoredLabel: {
    fontSize: 8,
    color: '#A8A29E',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  honoredNames: {
    fontSize: 15,
    fontFamily: 'serif',
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#57534E',
    fontFamily: 'serif',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  detailBox: {
    backgroundColor: '#FAF9F6',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E7E5E4',
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    color: '#78716C',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailText: {
    fontSize: 12,
    color: '#44403C',
    marginTop: 2,
  },
  detailHall: {
    fontSize: 11,
    color: '#78716C',
    fontStyle: 'italic',
    marginTop: 2,
  },
  detailDeadline: {
    fontSize: 12,
    color: '#1C1917',
    fontWeight: '700',
    marginTop: 2,
  },
  btnRSVP: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  btnRSVPText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formTitle: {
    fontSize: 20,
    fontFamily: 'serif',
    color: '#1C1917',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 12,
    color: '#78716C',
    lineHeight: 16,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  guestCard: {
    borderColor: '#F3F4F6',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FCFCFB',
  },
  guestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  guestNumber: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '600',
  },
  guestName: {
    fontSize: 15,
    fontFamily: 'serif',
    fontWeight: '700',
    color: '#1F2937',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  toggleBtnDeclined: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  guestDetails: {
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
    paddingTop: 12,
    gap: 14,
  },
  inputGroup: {
    width: '100%',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1F2937',
  },
  pickerWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  mealChipText: {
    fontSize: 11,
    color: '#4B5563',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchText: {
    fontSize: 12,
    color: '#4B5563',
  },
  btnSubmitRSVP: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  btnSubmitRSVPText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  lockoutContent: {
    padding: 24,
    alignItems: 'center',
  },
  iconBlockedBg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'serif',
    color: '#111827',
    marginBottom: 8,
  },
  lockoutText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  lockoutFooter: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    width: '100%',
  },
  lockoutFooterText: {
    fontSize: 10.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 15,
  },
  successCard: {
    padding: 24,
    alignItems: 'center',
  },
  successIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'serif',
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  successText: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  btnSecondaryText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
});
