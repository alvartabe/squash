import { queryKeys } from '@squash/api-client';
import type { PlayerProfile, UpdatePlayerProfile } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/src/components/screen';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';

type DominantHand = PlayerProfile['dominantHand'];
type ProfileVisibility = NonNullable<PlayerProfile['visibility']>;

const dominantHands: Array<{ value: DominantHand; label: Parameters<typeof t>[0] }> = [
  { value: null, label: 'profile.noDominantHand' },
  { value: 'left', label: 'profile.leftHanded' },
  { value: 'right', label: 'profile.rightHanded' },
  { value: 'ambidextrous', label: 'profile.ambidextrous' },
];

const visibilityOptions: Array<{
  value: ProfileVisibility;
  label: Parameters<typeof t>[0];
  description: Parameters<typeof t>[0];
}> = [
  {
    value: 'private',
    label: 'profile.visibilityPrivate',
    description: 'profile.visibilityPrivateDescription',
  },
  {
    value: 'friends',
    label: 'profile.visibilityFriends',
    description: 'profile.visibilityFriendsDescription',
  },
  {
    value: 'shared-clubs',
    label: 'profile.visibilityCommunity',
    description: 'profile.visibilityCommunityDescription',
  },
];

export default function ProfileScreen() {
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const profile = useQuery({
    queryKey: queryKeys.profile(playerId ?? 'signed-out'),
    queryFn: () => api.getProfile(),
    enabled: Boolean(playerId),
  });

  if (!session.isPending && !playerId) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>{t('profile.heading')}</Text>
      <Text style={styles.description}>{t('profile.description')}</Text>
      {profile.isPending ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.description}>{t('common.loading')}</Text>
        </View>
      ) : profile.isError || !profile.data ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t('profile.loadError')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => profile.refetch()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <ProfileForm playerId={playerId!} profile={profile.data.data} />
      )}
      <Pressable onPress={() => router.push('/notifications' as Href)}>
        <Text>{t('profile.notifications')}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/notification-preferences' as Href)}>
        <Text>{t('profile.notificationPreferences')}</Text>
      </Pressable>
      <Pressable onPress={() => authClient.signOut()}>
        <Text>{t('profile.signOut')}</Text>
      </Pressable>
    </Screen>
  );
}

function ProfileForm({ playerId, profile }: { playerId: string; profile: PlayerProfile }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [dominantHand, setDominantHand] = useState<DominantHand>(profile.dominantHand);
  const [visibility, setVisibility] = useState<ProfileVisibility | null>(profile.visibility);
  const [validationError, setValidationError] = useState(false);
  const [visibilityError, setVisibilityError] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setBio(profile.bio ?? '');
    setDominantHand(profile.dominantHand);
    setVisibility(profile.visibility);
  }, [profile]);

  const save = useMutation({
    mutationFn: (input: UpdatePlayerProfile) => api.updateProfile(input),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.profile(playerId), { data });
      setSaved(true);
    },
  });

  const submit = () => {
    setSaved(false);
    if (!name.trim()) {
      setValidationError(true);
      return;
    }
    if (!visibility) {
      setVisibilityError(true);
      return;
    }
    setValidationError(false);
    setVisibilityError(false);
    save.mutate({
      name: name.trim(),
      bio: bio.trim() || null,
      dominantHand,
      visibility,
      locale: profile.locale,
      timeZone: profile.timeZone,
    });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{t('profile.displayName')}</Text>
      <TextInput
        accessibilityLabel={t('profile.displayName')}
        autoCapitalize="words"
        maxLength={120}
        onChangeText={setName}
        style={styles.input}
        value={name}
      />
      <Text style={styles.label}>{t('profile.biography')}</Text>
      <TextInput
        accessibilityLabel={t('profile.biography')}
        maxLength={1000}
        multiline
        onChangeText={setBio}
        style={[styles.input, styles.multilineInput]}
        textAlignVertical="top"
        value={bio}
      />
      <Text style={styles.label}>{t('profile.dominantHand')}</Text>
      <View style={styles.options}>
        {dominantHands.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.value ?? 'none'}
            onPress={() => setDominantHand(option.value)}
            style={[
              styles.option,
              dominantHand === option.value ? styles.selectedOption : undefined,
            ]}
          >
            <Text
              style={dominantHand === option.value ? styles.selectedOptionText : styles.optionText}
            >
              {t(option.label)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t('profile.visibility')}</Text>
      <View style={styles.options}>
        {visibilityOptions.map((option) => (
          <Pressable
            accessibilityHint={t(option.description)}
            accessibilityRole="button"
            key={option.value}
            onPress={() => setVisibility(option.value)}
            style={[
              styles.visibilityOption,
              visibility === option.value ? styles.selectedOption : undefined,
            ]}
          >
            <Text
              style={visibility === option.value ? styles.selectedOptionText : styles.optionText}
            >
              {t(option.label)}
            </Text>
            <Text
              style={
                visibility === option.value ? styles.selectedDescription : styles.optionDescription
              }
            >
              {t(option.description)}
            </Text>
          </Pressable>
        ))}
      </View>
      {validationError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('profile.nameRequired')}
        </Text>
      ) : null}
      {visibilityError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('profile.visibilityRequired')}
        </Text>
      ) : null}
      {save.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('profile.saveError')}
        </Text>
      ) : null}
      {saved ? <Text style={styles.success}>{t('profile.saved')}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={save.isPending}
        onPress={submit}
        style={[styles.saveButton, save.isPending ? styles.disabled : undefined]}
      >
        <Text style={styles.saveButtonText}>
          {t(save.isPending ? 'profile.saving' : 'profile.save')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  description: { color: colors.muted, lineHeight: 21 },
  state: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  form: { gap: spacing.sm },
  label: { color: colors.foreground, fontWeight: '700', marginTop: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multilineInput: { minHeight: 112 },
  options: { gap: spacing.sm },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  visibilityOption: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  selectedOption: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { color: colors.foreground, fontWeight: '700' },
  selectedOptionText: { color: colors.background, fontWeight: '700' },
  optionDescription: { color: colors.muted, lineHeight: 20 },
  selectedDescription: { color: colors.background, lineHeight: 20 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  buttonText: { color: colors.primary, fontWeight: '700' },
  saveButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  saveButtonText: { color: colors.background, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: colors.destructive, lineHeight: 21 },
  success: { color: colors.primary, fontWeight: '700' },
});
