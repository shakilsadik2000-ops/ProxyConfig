/**
 * Profiles — list, select, edit, swipe-to-delete, and add proxy profiles.
 * Stitch redesign: white card rows, colored protocol pills, blue FAB.
 */
import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {RectButton, Swipeable} from 'react-native-gesture-handler';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';

import ProfileRow from '../components/ProfileRow';
import {profileStore} from '../store/profileStore';
import {getActiveProfileId, setActiveProfileId} from '../store/settingsStore';
import {ProxyProfile} from '../types';
import {ProfilesStackParamList} from '../navigation/AppNavigator';
import {colors, radius, spacing, typography} from '../theme/tokens';

type Nav = NativeStackNavigationProp<ProfilesStackParamList, 'ProfileList'>;

function ProfileListScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [profiles, setProfiles] = useState<ProxyProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const all = await profileStore.getAll();
    setProfiles(all);
    setActiveId(getActiveProfileId());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const selectProfile = (p: ProxyProfile) => {
    setActiveProfileId(p.id);
    setActiveId(p.id);
    ToastAndroid.show(`${p.name} is now active`, ToastAndroid.SHORT);
  };

  const confirmDelete = (p: ProxyProfile) => {
    Alert.alert('Delete profile', `Delete "${p.name}"? This can't be undone.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await profileStore.delete(p.id);
          if (getActiveProfileId() === p.id) setActiveProfileId(null);
          await reload();
          ToastAndroid.show('Profile deleted', ToastAndroid.SHORT);
        },
      },
    ]);
  };

  const renderRightActions = (p: ProxyProfile) => (
    <RectButton style={styles.deleteAction} onPress={() => confirmDelete(p)}>
      <Icon name="trash-2" size={22} color={colors.white} />
      <Text style={styles.deleteText}>Delete</Text>
    </RectButton>
  );

  return (
    <View style={styles.container}>
      {profiles.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyChip}>
            <Icon name="shield" size={28} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Secure Connections</Text>
          <Text style={styles.emptyText}>
            Your traffic is routed through the selected active profile. Use the
            button below to add server configurations.
          </Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            <Swipeable renderRightActions={() => renderRightActions(item)}>
              <ProfileRow
                profile={item}
                active={item.id === activeId}
                onPress={() => selectProfile(item)}
                onEdit={() =>
                  navigation.navigate('AddEditProfile', {profileId: item.id})
                }
              />
            </Swipeable>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AddEditProfile')}>
        <Icon name="plus" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  list: {padding: spacing.md, paddingBottom: 96},
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  deleteText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyChip: {
    width: 64,
    height: 64,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceChip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ProfileListScreen;
