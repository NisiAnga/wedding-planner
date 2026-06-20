import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Clipboard, Platform, Image } from 'react-native';
import { FileText, Paintbrush, Users, FileSpreadsheet, Settings, LogOut, Plus, Trash2, Copy, RefreshCw } from 'lucide-react-native';
import { CoupleDesign, Guest } from '../types';
import { COLOR_PRESETS, BANNER_PRESETS } from '../presets';

interface AdminCustomizerProps {
  design: CoupleDesign;
  onDesignUpdate: (updated: CoupleDesign) => void;
  guests: Guest[];
  onGuestsUpdate: (updated: Guest[]) => void;
  onLogout: () => void;
  onReset: () => void;
  onPreviewGuest: () => void;
}

export default function AdminCustomizer({
  design,
  onDesignUpdate,
  guests,
  onGuestsUpdate,
  onLogout,
  onReset,
  onPreviewGuest
}: AdminCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'style' | 'guests' | 'sheets' | 'settings'>('text');
  
  // Roster inputs
  const [newGuestName, setNewGuestName] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newPlusOne, setNewPlusOne] = useState(false);

  // Link generator search
  const [generatorSearch, setGeneratorSearch] = useState('');
  const [showLinkList, setShowLinkList] = useState(false);

  // Custom Palette state
  const [customPalForm, setCustomPalForm] = useState({
    name: '',
    primary: '#5F7464',
    accent: '#B5A475',
    border: '#C2CBC4',
    canvas: '#F7F8F7'
  });

  const handleDesignChange = (field: keyof CoupleDesign, value: any) => {
    onDesignUpdate({
      ...design,
      [field]: value
    });
  };

  const handleAddGuest = () => {
    if (!newGuestName.trim() || !newHouseholdName.trim()) {
      alert('Please fill in both the guest name and household party name.');
      return;
    }
    const householdNameClean = newHouseholdName.trim();
    const existing = guests.find(g => g.householdName.toLowerCase() === householdNameClean.toLowerCase());
    const householdId = existing ? existing.householdId : `h_${Date.now()}`;

    const newGuest: Guest = {
      id: `g_${Date.now()}`,
      name: newGuestName.trim(),
      householdId,
      householdName: householdNameClean,
      isAttending: null,
      mealSelection: '',
      dietaryRestrictions: '',
      hasPlusOneAllowed: newPlusOne,
      plusOneName: '',
      songRequest: ''
    };

    onGuestsUpdate([...guests, newGuest]);
    setNewGuestName('');
    setNewHouseholdName('');
    setNewPlusOne(false);
  };

  const handleDeleteGuest = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (confirm(`Remove guest ${name}?`)) {
        onGuestsUpdate(guests.filter(g => g.id !== id));
      }
    } else {
      // Direct update for mobile layout
      onGuestsUpdate(guests.filter(g => g.id !== id));
    }
  };

  const handleCopyCode = () => {
    const templateCode = `// Google Sheets Apps Script Web Service For Wedding RSVP Synchronizer
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var payload = JSON.parse(e.postData.contents);
    var timestamp = new Date();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Guest ID", "Guest Name", "Household ID", "Household Name", "RSVP Status", "Meal Selection", "Dietary Restrictions", "Plus One Name", "Song Request", "Timestamp"]);
      sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#EDF2F7");
    }
    var guestsToSave = Array.isArray(payload) ? payload : [payload];
    var lastRow = sheet.getLastRow();
    for (var i = 0; i < guestsToSave.length; i++) {
       var guest = guestsToSave[i];
       if (!guest) continue;
       var guestId = guest.id;
       var foundIndex = -1;
       if (lastRow > 1) {
         var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
         for (var row = 0; row < ids.length; row++) {
           if (ids[row][0] == guestId) { foundIndex = row + 2; break; }
         }
       }
       var statusString = guest.isAttending === true ? "Accepts" : guest.isAttending === false ? "Declines" : "Pending";
       var rowData = [guest.id, guest.name, guest.householdId, guest.householdName, statusString, guest.mealSelection || "Pending", guest.dietaryRestrictions || "None", guest.plusOneName || "N/A", guest.songRequest || "None", timestamp];
       if (foundIndex !== -1) {
         sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
       } else {
         sheet.appendRow(rowData);
       }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;
    Clipboard.setString(templateCode);
    alert('Google Apps Script sync template code copied to clipboard!');
  };

  const handleCopyLink = (name: string) => {
    const base = Platform.OS === 'web' ? window.location.origin + window.location.pathname : 'https://your-wedding-web.com/';
    const link = `${base}?g=${encodeURIComponent(name)}`;
    Clipboard.setString(link);
    alert(`Copied link for ${name}!`);
  };

  // KPI Ratios
  const accepts = guests.filter(g => g.isAttending === true).length;
  const declines = guests.filter(g => g.isAttending === false).length;
  const pending = guests.filter(g => g.isAttending === null).length;

  return (
    <View style={styles.container}>
      {/* Top Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Planner Admin</Text>
          <Text style={styles.headerSub}>Customize values and manage invitees</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.previewBtn} onPress={onPreviewGuest}>
            <Text style={styles.previewBtnText}>Card Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <LogOut size={16} color="#B91C1C" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs list */}
      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'text' && styles.tabActive]} onPress={() => setActiveTab('text')}>
          <FileText size={16} color={activeTab === 'text' ? '#1C1917' : '#78716C'} />
          <Text style={[styles.tabText, activeTab === 'text' && styles.tabTextActive]}>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'style' && styles.tabActive]} onPress={() => setActiveTab('style')}>
          <Paintbrush size={16} color={activeTab === 'style' ? '#1C1917' : '#78716C'} />
          <Text style={[styles.tabText, activeTab === 'style' && styles.tabTextActive]}>Styles</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'guests' && styles.tabActive]} onPress={() => setActiveTab('guests')}>
          <Users size={16} color={activeTab === 'guests' ? '#1C1917' : '#78716C'} />
          <Text style={[styles.tabText, activeTab === 'guests' && styles.tabTextActive]}>Guests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'sheets' && styles.tabActive]} onPress={() => setActiveTab('sheets')}>
          <FileSpreadsheet size={16} color={activeTab === 'sheets' ? '#1C1917' : '#78716C'} />
          <Text style={[styles.tabText, activeTab === 'sheets' && styles.tabTextActive]}>Sync</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'settings' && styles.tabActive]} onPress={() => setActiveTab('settings')}>
          <Settings size={16} color={activeTab === 'settings' ? '#1C1917' : '#78716C'} />
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>Config</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable inputs wrapper */}
      <ScrollView contentContainerStyle={styles.scrollBody}>
        
        {/* TAB 1: TEXT DETAILS */}
        {activeTab === 'text' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Invitation Text Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Couple Names</Text>
              <TextInput style={styles.input} value={design.coupleNames} onChangeText={(val) => handleDesignChange('coupleNames', val)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Default Card Invitee Names</Text>
              <TextInput style={styles.input} placeholder="Our Cherished Family & Friends" value={design.inviteeNames} onChangeText={(val) => handleDesignChange('inviteeNames', val)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Wedding Date</Text>
              <TextInput style={styles.input} value={design.weddingDate} onChangeText={(val) => handleDesignChange('weddingDate', val)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Venue Location</Text>
              <TextInput style={styles.input} value={design.weddingVenue} onChangeText={(val) => handleDesignChange('weddingVenue', val)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Wedding Hall</Text>
              <TextInput style={styles.input} placeholder="e.g. Pavilion Hall" value={design.weddingHall} onChangeText={(val) => handleDesignChange('weddingHall', val)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>RSVP Deadline</Text>
              <TextInput style={styles.input} value={design.rsvpDeadline} onChangeText={(val) => handleDesignChange('rsvpDeadline', val)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Welcome Greeting Message</Text>
              <TextInput multiline numberOfLines={3} style={[styles.input, styles.textArea]} value={design.invitationWelcome} onChangeText={(val) => handleDesignChange('invitationWelcome', val)} />
            </View>
          </View>
        )}

        {/* TAB 2: THEMING & COVER BANNER */}
        {activeTab === 'style' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Theming & Colors</Text>
            
            <Text style={styles.label}>Pre-made Themes</Text>
            <View style={styles.gridRow}>
              {COLOR_PRESETS.map((p) => {
                const isSelected = design.selectedPresetTheme === p.name || design.primaryColor === p.primary;
                return (
                  <TouchableOpacity 
                    key={p.name} 
                    style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                    onPress={() => {
                      onDesignUpdate({
                        ...design,
                        selectedPresetTheme: p.name,
                        primaryColor: p.primary,
                        accentColor: p.accent,
                        borderColor: p.border,
                        canvasBg: p.canvas
                      });
                    }}
                  >
                    <Text style={styles.presetName}>{p.name}</Text>
                    <View style={styles.colorDots}>
                      <View style={[styles.colorDot, { backgroundColor: p.primary }]} />
                      <View style={[styles.colorDot, { backgroundColor: p.accent }]} />
                      <View style={[styles.colorDot, { backgroundColor: p.canvas, borderWidth: 1, borderColor: '#E5E7EB' }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>Border Accent Style</Text>
            <View style={styles.gridRow}>
              {["Modern Rounded", "Double Classic", "Vintage Regal", "Top Accent Stripe"].map((bStyle) => (
                <TouchableOpacity
                  key={bStyle}
                  style={[styles.styleBtn, design.borderStyle === bStyle && styles.styleBtnActive]}
                  onPress={() => handleDesignChange('borderStyle', bStyle)}
                >
                  <Text style={[styles.styleBtnText, design.borderStyle === bStyle && styles.styleBtnTextActive]}>
                    {bStyle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>Choose Preset Banner Picture</Text>
            <View style={styles.bannerPresetsRow}>
              {BANNER_PRESETS.map((b) => (
                <TouchableOpacity
                  key={b.name}
                  style={[styles.bannerPresetBtn, design.bannerUrl === b.url && styles.bannerPresetBtnActive]}
                  onPress={() => handleDesignChange('bannerUrl', b.url)}
                >
                  <Image source={{ uri: b.url }} style={styles.bannerPresetImg} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Or Custom Image URL</Text>
              <TextInput style={styles.input} value={design.bannerUrl} onChangeText={(val) => handleDesignChange('bannerUrl', val)} />
            </View>
          </View>
        )}

        {/* TAB 3: GUEST ROSTER MANAGER */}
        {activeTab === 'guests' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Invitee & Roster Manager</Text>
            
            {/* Ratios stats */}
            <View style={styles.statsCard}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{accepts}</Text>
                <Text style={styles.statLabel}>Yes</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{declines}</Text>
                <Text style={styles.statLabel}>No</Text>
              </View>
            </View>

            {/* Quick Add Form */}
            <View style={styles.panelForm}>
              <Text style={styles.panelFormTitle}>Add Guest Household</Text>
              <TextInput style={styles.input} placeholder="Guest Full Name (e.g. John Doe)" value={newGuestName} onChangeText={setNewGuestName} />
              <TextInput style={styles.input} placeholder="Household Party Name (e.g. Doe Family)" value={newHouseholdName} onChangeText={setNewHouseholdName} />
              
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Allow Plus-One Guest?</Text>
                <Switch value={newPlusOne} onValueChange={setNewPlusOne} />
              </View>

              <TouchableOpacity style={[styles.btnAdd, { backgroundColor: design.primaryColor }]} onPress={handleAddGuest}>
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.btnAddText}>Add Invitee</Text>
              </TouchableOpacity>
            </View>

            {/* Unique Link Generator toggle button */}
            <TouchableOpacity 
              style={styles.linksGeneratorBtn} 
              onPress={() => setShowLinkList(!showLinkList)}
            >
              <Text style={styles.linksGeneratorBtnText}>
                {showLinkList ? 'Hide Invitation Link List' : 'View Guest Invitation Links'}
              </Text>
            </TouchableOpacity>

            {showLinkList && (
              <View style={styles.linksBox}>
                <Text style={styles.linksBoxTitle}>Unique Invitation Links</Text>
                <TextInput 
                  style={styles.linksSearch} 
                  placeholder="Search guests by name..." 
                  value={generatorSearch} 
                  onChangeText={setGeneratorSearch} 
                />
                
                <View style={styles.linksList}>
                  {guests
                    .filter(g => g.name.toLowerCase().includes(generatorSearch.toLowerCase()))
                    .map(g => (
                      <View key={g.id} style={styles.linkRow}>
                        <View style={styles.linkInfo}>
                          <Text style={styles.linkGuestName}>{g.name}</Text>
                          <Text style={styles.linkGuestParty}>Party: {g.householdName}</Text>
                        </View>
                        <TouchableOpacity style={[styles.copyLinkBtn, { backgroundColor: `${design.primaryColor}15` }]} onPress={() => handleCopyLink(g.name)}>
                          <Copy size={12} color={design.primaryColor} />
                          <Text style={[styles.copyLinkBtnText, { color: design.primaryColor }]}>Copy Link</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* Editable Guest Roster list */}
            <Text style={styles.label}>Roster List (Tap fields to edit inline)</Text>
            <View style={styles.rosterContainer}>
              {guests.map((g) => (
                <View key={g.id} style={styles.rosterRow}>
                  <View style={styles.rosterInputs}>
                    <TextInput
                      style={styles.rosterInputName}
                      value={g.name}
                      onChangeText={(val) => {
                        const updated = guests.map(item => item.id === g.id ? { ...item, name: val } : item);
                        onGuestsUpdate(updated);
                      }}
                    />
                    <TextInput
                      style={styles.rosterInputParty}
                      value={g.householdName}
                      onChangeText={(val) => {
                        const updated = guests.map(item => item.id === g.id ? { ...item, householdName: val } : item);
                        onGuestsUpdate(updated);
                      }}
                    />
                  </View>
                  <View style={styles.rosterActions}>
                    <View style={[
                      styles.rosterAttendingBadge,
                      g.isAttending === true && styles.attendingYes,
                      g.isAttending === false && styles.attendingNo
                    ]}>
                      <Text style={styles.rosterBadgeText}>
                        {g.isAttending === true ? 'Yes' : g.isAttending === false ? 'No' : 'Pending'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteGuest(g.id, g.name)}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TAB 4: GOOGLE SHEET CONFIGURATION */}
        {activeTab === 'sheets' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Google Sheets Connection</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>1. Google Spreadsheet Link</Text>
              <TextInput style={styles.input} placeholder="https://docs.google.com/spreadsheets/d/.../edit" value={design.spreadSheetUrl} onChangeText={(val) => handleDesignChange('spreadSheetUrl', val)} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>2. Deployed Webhook API URL</Text>
              <TextInput style={styles.input} placeholder="https://script.google.com/macros/s/.../exec" value={design.googleSheetsUrl} onChangeText={(val) => handleDesignChange('googleSheetsUrl', val)} />
            </View>

            <View style={styles.panelForm}>
              <Text style={styles.panelFormTitle}>Spreadsheet Synchronization Code</Text>
              <Text style={styles.formSub}>Copy our custom sync logic code to your Google Apps Script script editor.</Text>
              
              <TouchableOpacity style={styles.btnCopyCode} onPress={handleCopyCode}>
                <Copy size={14} color="#FFFFFF" />
                <Text style={styles.btnCopyCodeText}>Copy Script Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 5: PREFERENCES & FACTORY RESET */}
        {activeTab === 'settings' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>RSVP Feature Flags</Text>

            <View style={styles.switchItem}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchItemTitle}>Enable Meal Choices</Text>
                <Text style={styles.switchItemSub}>Collect dinner menu preferences</Text>
              </View>
              <Switch value={design.enableMealSelection} onValueChange={(val) => handleDesignChange('enableMealSelection', val)} />
            </View>

            {design.enableMealSelection && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Entrée Options list (comma-separated)</Text>
                <TextInput style={styles.input} value={design.mealOptions} onChangeText={(val) => handleDesignChange('mealOptions', val)} />
              </View>
            )}

            <View style={styles.switchItem}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchItemTitle}>Request Dietary Restrictions</Text>
                <Text style={styles.switchItemSub}>Collect allergies and dietary details</Text>
              </View>
              <Switch value={design.enableDietaryRestrictions} onValueChange={(val) => handleDesignChange('enableDietaryRestrictions', val)} />
            </View>

            <View style={styles.switchItem}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchItemTitle}>Enable Song Requests</Text>
                <Text style={styles.switchItemSub}>Collect music requests on card</Text>
              </View>
              <Switch value={design.enableSongRequests} onValueChange={(val) => handleDesignChange('enableSongRequests', val)} />
            </View>

            <View style={styles.switchItem}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchItemTitle}>Support Plus-One Guests</Text>
                <Text style={styles.switchItemSub}>Allow plus-ones for enabled guests</Text>
              </View>
              <Switch value={design.enablePlusOnesGlobally} onValueChange={(val) => handleDesignChange('enablePlusOnesGlobally', val)} />
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.btnReset} onPress={onReset}>
              <Text style={styles.btnResetText}>Reset App to Factory Defaults</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'serif',
    color: '#1C1917',
  },
  headerSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  previewBtnText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1C1917',
  },
  tabText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#78716C',
  },
  tabTextActive: {
    color: '#1C1917',
  },
  scrollBody: {
    padding: 20,
    paddingBottom: 60,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'serif',
    color: '#1C1917',
    marginBottom: 4,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
  },
  presetCardSelected: {
    borderColor: '#1C1917',
    borderWidth: 2,
  },
  presetName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1917',
  },
  colorDots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  styleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  styleBtnActive: {
    borderColor: '#1C1917',
    backgroundColor: '#FAF9F6',
  },
  styleBtnText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  styleBtnTextActive: {
    color: '#1C1917',
    fontWeight: '700',
  },
  bannerPresetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bannerPresetBtn: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    opacity: 0.6,
  },
  bannerPresetBtnActive: {
    opacity: 1,
    borderColor: '#1C1917',
    borderWidth: 2,
  },
  bannerPresetImg: {
    width: '100%',
    height: '100%',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'serif',
    color: '#1C1917',
  },
  statLabel: {
    fontSize: 9,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  panelForm: {
    backgroundColor: '#FAF9F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  panelFormTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#44403C',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 12,
    color: '#44403C',
  },
  btnAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  btnAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  linksGeneratorBtn: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  linksGeneratorBtnText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },
  linksBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  linksBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  linksSearch: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
  },
  linksList: {
    maxHeight: 180,
    gap: 8,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomColor: '#F3F4F6',
    borderBottomWidth: 1,
  },
  linkInfo: {
    flex: 1,
  },
  linkGuestName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  linkGuestParty: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  copyLinkBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  rosterContainer: {
    gap: 8,
  },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: '#F3F4F6',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FCFCFB',
  },
  rosterInputs: {
    flex: 1,
    marginRight: 10,
  },
  rosterInputName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    padding: 2,
    borderBottomColor: 'transparent',
    borderBottomWidth: 1,
  },
  rosterInputParty: {
    fontSize: 10,
    color: '#9CA3AF',
    padding: 2,
    borderBottomColor: 'transparent',
    borderBottomWidth: 1,
  },
  rosterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rosterAttendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  attendingYes: {
    backgroundColor: '#D1FAE5',
  },
  attendingNo: {
    backgroundColor: '#FEE2E2',
  },
  rosterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#374151',
  },
  btnCopyCode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  btnCopyCodeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchTextCol: {
    flex: 1,
  },
  switchItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  switchItemSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  btnReset: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    borderColor: '#EF4444',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnResetText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  formSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 16,
  },
});
