import { Redirect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CertificatePromptModal } from '../components/CertificatePromptModal';
import { LanguageSelector } from '../components/LanguageSelector';
import WaveformLogo from '../components/WaveformLogo';
import { fetchServerInfo, login as subsonicLogin } from '../services/subsonicService';
import { trustCertificateForHost } from '../services/sslTrustService';
import { authStore } from '../store/authStore';
import { onboardingStore } from '../store/onboardingStore';
import { serverInfoStore } from '../store/serverInfoStore';

import {
  getCertificateInfo,
  isSSLError,
  type CertificateInfo,
} from '../../modules/expo-ssl-trust/src';

const PRIMARY = '#1D9BF0';

export function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const isLoggedIn = authStore((s) => s.isLoggedIn);
  const setSession = authStore((s) => s.setSession);

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [legacyAuth, setLegacyAuth] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // SSL certificate prompt state
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certInfo, setCertInfo] = useState<CertificateInfo | null>(null);
  const [certHostname, setCertHostname] = useState('');
  const [isCertRotation, setIsCertRotation] = useState(false);

  const handleTrustCertificate = useCallback(async () => {
    if (!certInfo || !certHostname) return;

    setCertModalVisible(false);
    setLoading(true);
    setError(null);

    try {
      // Trust the certificate (persists in Zustand + syncs to native)
      await trustCertificateForHost(certHostname, certInfo.sha256Fingerprint, certInfo.validTo);

      // Retry the login
      const url = serverUrl.trim();
      const user = username.trim();
      const pass = password;

      const result = await subsonicLogin(url, user, pass, legacyAuth);
      setLoading(false);

      if (result.success) {
        setSession(url, user, pass, result.version, legacyAuth);
        const info = await fetchServerInfo();
        if (info) serverInfoStore.getState().setServerInfo(info);
        router.replace('/');
      } else {
        setError(result.error || t('connectionFailedAfterTrust'));
      }
    } catch (e) {
      setLoading(false);
      setError(
        t('failedToTrustCertificate', {
          message: e instanceof Error ? e.message : t('unknownError'),
        })
      );
    }
  }, [certInfo, certHostname, serverUrl, username, password, legacyAuth, setSession, router]);

  const handleCancelCert = useCallback(() => {
    setCertModalVisible(false);
    setError(t('connectionCancelledUntrusted'));
  }, [t]);

  if (isLoggedIn) {
    return <Redirect href="/" />;
  }

  const handleManualCertTrust = async () => {
    const url = serverUrl.trim();
    if (!url) {
      setError(t('enterServerAddressFirst'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      let normalized = url;
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = `https://${normalized}`;
      }
      const hostname = extractHostname(url);
      const info = await getCertificateInfo(normalized);
      setCertInfo(info);
      setCertHostname(hostname);
      setIsCertRotation(false);
      setCertModalVisible(true);
    } catch (e) {
      setError(
        t('couldNotRetrieveCertificate', {
          message: e instanceof Error ? e.message : t('unknownError'),
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const extractHostname = (url: string): string => {
    let normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    try {
      return new URL(normalized).hostname;
    } catch {
      return normalized;
    }
  };

  const handleSubmit = async () => {
    const url = serverUrl.trim();
    const user = username.trim();
    const pass = password;

    if (!url || !user || !pass) {
      setError(t('fillAllFields'));
      return;
    }
    setError(null);
    setLoading(true);

    const result = await subsonicLogin(url, user, pass, legacyAuth);

    if (result.success) {
      setLoading(false);
      setSession(url, user, pass, result.version, legacyAuth);
      const info = await fetchServerInfo();
      if (info) serverInfoStore.getState().setServerInfo(info);
      if (!onboardingStore.getState().hasCompleted) {
        onboardingStore.getState().show();
      }
      router.replace('/');
      return;
    }

    // Check if the error is SSL-related
    const errorMsg = result.error || t('connectionFailed');
    if (isSSLError(errorMsg)) {
      // Try to fetch the certificate for inspection
      try {
        const hostname = extractHostname(url);
        const info = await getCertificateInfo(url);
        const isRotation = errorMsg.includes('CERT_FINGERPRINT_MISMATCH');

        setCertInfo(info);
        setCertHostname(hostname);
        setIsCertRotation(isRotation);
        setCertModalVisible(true);
        setLoading(false);
      } catch (certErr) {
        setLoading(false);
        setError(
          t('sslCertificateRetrievalError', {
            message: certErr instanceof Error ? certErr.message : '',
          }).trim()
        );
      }
    } else {
      setLoading(false);
      setError(errorMsg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <WaveformLogo size={80} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>substreamer</Text>
        <Text style={styles.subtitle}>
          {t('loginSubtitle')}
        </Text>

        {/* Form */}
        <View>
          <TextInput
            style={styles.input}
            placeholder={t('loginServerPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.85)"
            value={serverUrl}
            onChangeText={(t) => {
              setServerUrl(t);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder={t('username')}
            placeholderTextColor="rgba(255,255,255,0.85)"
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          <TextInput
            style={[styles.input, styles.inputLast]}
            placeholder={t('password')}
            placeholderTextColor="rgba(255,255,255,0.85)"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            secureTextEntry
            editable={!loading}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <Pressable
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced((prev) => !prev)}
          >
            <Text style={styles.advancedToggleText}>
              {showAdvanced ? t('hideAdvancedOptions') : t('advancedOptions')}
            </Text>
          </Pressable>

          {showAdvanced && (
            <View style={styles.advancedSection}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>{t('legacyAuthentication')}</Text>
                  <Text style={styles.switchHint}>
                    {t('legacyAuthenticationHint')}
                  </Text>
                </View>
                <Switch
                  value={legacyAuth}
                  onValueChange={setLegacyAuth}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FFFFFF' }}
                  thumbColor={legacyAuth ? PRIMARY : 'rgba(255,255,255,0.9)'}
                  ios_backgroundColor="rgba(255,255,255,0.2)"
                  disabled={loading}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.certButton,
                  pressed && !loading && styles.certButtonPressed,
                ]}
                onPress={handleManualCertTrust}
                disabled={loading}
              >
                <Text style={styles.certButtonText}>{t('trustServerCertificate')}</Text>
                <Text style={styles.switchHint}>
                  {t('trustServerCertificateHint')}
                </Text>
              </Pressable>
            </View>
          )}

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          {/* Submit button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={PRIMARY} />
            ) : (
              <Text style={styles.buttonText}>{t('logIn')}</Text>
            )}
          </Pressable>

          <View style={styles.languageSelector}>
            <LanguageSelector variant="login" />
          </View>
        </View>
      </View>

      {/* SSL Certificate Prompt */}
      <CertificatePromptModal
        visible={certModalVisible}
        certInfo={certInfo}
        hostname={certHostname}
        isRotation={isCertRotation}
        onTrust={handleTrustCertificate}
        onCancel={handleCancelCert}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: 24,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  inputLast: {
    marginBottom: 4,
  },
  error: {
    fontSize: 14,
    color: '#FFEB3B',
    marginTop: 8,
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  advancedToggle: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  advancedToggleText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  advancedSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  switchHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  certButton: {
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  certButtonPressed: {
    opacity: 0.6,
  },
  certButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  languageSelector: {
    marginTop: 16,
  },
});
