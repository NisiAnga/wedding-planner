import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Lock, AlertCircle, Sparkles } from 'lucide-react-native';

interface ActivationGateProps {
  isActivated: boolean;
  isDeviceAuthorized: boolean;
  onActivate: (passkey: string) => Promise<{ success: boolean; error?: string }>;
  onLogin: (passkey: string) => Promise<{ success: boolean; error?: string }>;
  onClose?: () => void;
  designPrimaryColor: string;
}

export default function ActivationGate({
  isActivated,
  isDeviceAuthorized,
  onActivate,
  onLogin,
  onClose,
  designPrimaryColor
}: ActivationGateProps) {
  const [passkey, setPasskey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!passkey.trim()) {
      setErrorMsg('Please enter your passkey');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = isActivated 
        ? await onLogin(passkey.trim())
        : await onActivate(passkey.trim());
      
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid passkey.');
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Gated device lockout
  if (isActivated && !isDeviceAuthorized) {
    return (
      <View style={styles.fullscreen}>
        <View style={styles.card}>
          <View style={styles.iconContainerBlocked}>
            <Lock size={32} color="#E11D48" />
          </View>
          <Text style={styles.title}>Access Denied</Text>
          
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color="#991B1B" />
            <Text style={styles.errorBannerText}>
              <Text style={{ fontWeight: 'bold' }}>License Locked to Another Device{'\n'}</Text>
              This passkey is already bound to another phone or computer. Customization is restricted to the primary device.
            </Text>
          </View>

          <Text style={styles.description}>
            To transfer access or unlock this device, please edit the configuration database or contact your site administrator.
          </Text>

          {onClose && (
            <TouchableOpacity 
              style={styles.btnSecondary} 
              onPress={onClose}
            >
              <Text style={styles.btnSecondaryText}>Close View</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // 2. Normal login or activation input form
  return (
    <View style={styles.fullscreen}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <View style={[styles.iconContainer, { backgroundColor: `${designPrimaryColor}15` }]}>
            {isActivated ? (
              <Lock size={32} color={designPrimaryColor} />
            ) : (
              <Sparkles size={32} color={designPrimaryColor} />
            )}
          </View>

          <Text style={styles.title}>
            {isActivated ? 'Admin Login' : 'Activate Dashboard'}
          </Text>
          <Text style={styles.subtitle}>
            {isActivated 
              ? 'Enter your unique passkey to access customization tools' 
              : 'Enter your unique activation passkey to bind this device and customize the template'
            }
          </Text>

          {errorMsg ? (
            <View style={styles.validationError}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={styles.validationErrorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Passkey Password</Text>
            <TextInput
              secureTextEntry
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={passkey}
              onChangeText={setPasskey}
              autoFocus
            />
          </View>

          <View style={styles.btnGroup}>
            {onClose && (
              <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              disabled={isSubmitting}
              style={[styles.btnSubmit, { backgroundColor: designPrimaryColor }]} 
              onPress={handleSubmit}
            >
              <Text style={styles.btnSubmitText}>
                {isSubmitting ? 'Verifying...' : isActivated ? 'Unlock Admin' : 'Activate & Bind'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    padding: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconContainerBlocked: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'serif',
    color: '#1C1917',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  description: {
    fontSize: 12,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    width: '100%',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 16,
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    width: '100%',
    marginBottom: 16,
  },
  validationErrorText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    width: '100%',
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderColor: '#D1D5DB',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  btnSubmit: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderColor: '#D1D5DB',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
});
