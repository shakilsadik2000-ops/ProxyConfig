/**
 * Add / Edit Profile — validated form for a single proxy profile.
 *
 * Validates required fields and port range before save, supports a live
 * "Test Connection" probe (native, via the proxy), and an optional expiry date.
 */
import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Feather';

import {profileStore, generateId} from '../store/profileStore';
import {setActiveProfileId} from '../store/settingsStore';
import {VpnBridge} from '../native/VpnBridge';
import {Protocol, ProxyProfile} from '../types';
import {ProfilesStackParamList} from '../navigation/AppNavigator';
import {colors, radius, spacing, typography} from '../theme/tokens';

type Nav = NativeStackNavigationProp<ProfilesStackParamList, 'AddEditProfile'>;
type Rt = RouteProp<ProfilesStackParamList, 'AddEditProfile'>;

interface FormErrors {
  name?: string;
  host?: string;
  port?: string;
}

function AddEditProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const editingId = route.params?.profileId;

  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<Protocol>('SOCKS5');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [testing, setTesting] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // Hydrate when editing an existing profile.
  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const p = await profileStore.getById(editingId);
      if (!p) return;
      setName(p.name);
      setProtocol(p.protocol);
      setHost(p.host);
      setPort(String(p.port));
      setUsername(p.username);
      setPassword(p.password);
      setExpiryDate(p.expiryDate ? new Date(p.expiryDate) : null);
      setCreatedAt(p.createdAt);
    })();
  }, [editingId]);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Name is required';
    if (!host.trim()) next.host = 'Host / IP is required';
    const portNum = Number(port);
    if (!port.trim() || Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      next.port = 'Port must be between 1 and 65535';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildProfile = (): ProxyProfile => ({
    id: editingId ?? generateId(),
    name: name.trim(),
    protocol,
    host: host.trim(),
    port: Number(port),
    username: username.trim(),
    password,
    expiryDate: expiryDate ? expiryDate.toISOString() : undefined,
    createdAt: createdAt ?? new Date().toISOString(),
  });

  const onTest = async () => {
    if (!validate()) return;
    setTesting(true);
    try {
      const res = await VpnBridge.testConnection(buildProfile());
      if (res.success) {
        ToastAndroid.show(`Success — IP: ${res.ip}`, ToastAndroid.LONG);
      } else {
        ToastAndroid.show('Connection failed', ToastAndroid.LONG);
      }
    } catch (e: any) {
      ToastAndroid.show(e?.message ?? 'Connection failed', ToastAndroid.LONG);
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    if (!validate()) return;
    const profile = buildProfile();
    if (editingId) {
      await profileStore.update(profile);
      ToastAndroid.show('Profile updated', ToastAndroid.SHORT);
    } else {
      await profileStore.save(profile);
      setActiveProfileId(profile.id); // first-time saves become active
      ToastAndroid.show('Profile saved', ToastAndroid.SHORT);
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        {/* Name */}
        <Field label="Profile Name" error={errors.name}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="US Proxy - Instagram"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        {/* Protocol segmented control */}
        <Text style={styles.label}>Protocol</Text>
        <View style={styles.segment}>
          {(['HTTP', 'SOCKS5'] as Protocol[]).map(p => (
            <Pressable
              key={p}
              onPress={() => setProtocol(p)}
              style={[
                styles.segmentItem,
                protocol === p && styles.segmentItemActive,
              ]}>
              <Text
                style={[
                  styles.segmentText,
                  protocol === p && styles.segmentTextActive,
                ]}>
                {p}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Host */}
        <Field label="Host / IP" error={errors.host}>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="proxy.example.com or 1.2.3.4"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        {/* Port */}
        <Field label="Port" error={errors.port}>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            placeholder="1080"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        {/* Username */}
        <Field label="Username (optional)">
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="username"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        {/* Password with show/hide */}
        <Field label="Password (optional)">
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholder="password"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(s => !s)}
              hitSlop={8}>
              <Icon
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </Field>

        {/* Expiry date (optional) */}
        <Field label="Expiry Date (optional)">
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}>
            <Text
              style={{
                color: expiryDate ? colors.textPrimary : colors.textMuted,
                fontSize: typography.sizes.md,
              }}>
              {expiryDate ? expiryDate.toDateString() : 'No expiry'}
            </Text>
          </TouchableOpacity>
          {expiryDate && (
            <TouchableOpacity onPress={() => setExpiryDate(null)}>
              <Text style={styles.clearDate}>Clear date</Text>
            </TouchableOpacity>
          )}
        </Field>

        {showDatePicker && (
          <DateTimePicker
            value={expiryDate ?? new Date()}
            mode="date"
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (event.type === 'set' && date) setExpiryDate(date);
            }}
          />
        )}

        {/* Test connection */}
        <TouchableOpacity
          style={styles.testBtn}
          onPress={onTest}
          disabled={testing}>
          {testing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Icon name="activity" size={18} color={colors.primary} />
              <Text style={styles.testText}>Test Connection</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Save */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Labelled field wrapper with inline error text. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: colors.background},
  body: {padding: spacing.md, paddingBottom: spacing.xl},
  field: {marginBottom: spacing.md},
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    minHeight: 46,
    justifyContent: 'center',
  },
  error: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: typography.sizes.xs,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: spacing.md,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentItemActive: {backgroundColor: colors.primary},
  segmentText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {color: colors.white},
  passwordRow: {position: 'relative', justifyContent: 'center'},
  passwordInput: {paddingRight: 44},
  eyeBtn: {position: 'absolute', right: spacing.md},
  clearDate: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: typography.sizes.sm,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  testText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: typography.sizes.md,
    marginLeft: spacing.xs,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {color: colors.white, fontWeight: '700', fontSize: typography.sizes.lg},
});

export default AddEditProfileScreen;
