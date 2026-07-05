import { queryKeys } from '@squash/api-client';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react-native';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ClubRelationshipCard } from '@/src/components/club-relationship-card';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';
import {
  invitationAcceptanceErrorKey,
  refreshPlayerClubQueries,
} from '@/src/lib/player-club-mutations';

function DetailRow({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  onPress?: (() => void) | undefined;
}) {
  const content = (
    <>
      <Icon accessibilityElementsHidden color={colors.primary} size={20} />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, onPress ? styles.link : undefined]}>{value}</Text>
      </View>
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.detailRow, pressed ? styles.pressed : undefined]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.detailRow}>{content}</View>
  );
}

export default function ClubProfileScreen() {
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const params = useLocalSearchParams<{ clubId: string | string[] }>();
  const clubId = Array.isArray(params.clubId) ? params.clubId[0] : params.clubId;
  const queryClient = useQueryClient();
  const profileKey = [...queryKeys.clubProfile(clubId ?? ''), playerId ?? 'signed-out'] as const;
  const profileQuery = useQuery({
    queryKey: profileKey,
    queryFn: () => api.getClubProfile(clubId ?? ''),
    enabled: Boolean(clubId && playerId),
  });

  const refreshClubData = async () => {
    if (!clubId || !playerId) return;
    await refreshPlayerClubQueries(queryClient, clubId, playerId);
  };
  const submitRequest = useMutation({
    mutationFn: () => api.submitMembershipRequest(clubId ?? ''),
    onSuccess: refreshClubData,
  });
  const cancelRequest = useMutation({
    mutationFn: (requestId: string) => api.cancelMembershipRequest(clubId ?? '', requestId),
    onSuccess: refreshClubData,
  });
  const acceptInvitation = useMutation({
    mutationFn: (invitationId: string) => api.acceptClubInvitation(clubId ?? '', invitationId),
    onSuccess: refreshClubData,
  });
  const profile = profileQuery.data?.data;
  const openHttpUrl = (url: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    void Linking.openURL(url);
  };

  if (!session.isPending && !playerId) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profileQuery.isPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t('playerClubs.profileLoadError')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => profileQuery.refetch()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => profileQuery.refetch()}
            refreshing={profileQuery.isRefetching}
            tintColor={colors.primary}
          />
        }
      >
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.foreground} size={24} />
        </Pressable>

        {profile.logoUrl ? (
          <Image
            accessibilityLabel={profile.name}
            resizeMode="cover"
            source={{ uri: profile.logoUrl }}
            style={styles.logo}
          />
        ) : null}
        <Text style={styles.heading}>{profile.name}</Text>
        <ClubRelationshipCard
          hasMutationError={submitRequest.isError || cancelRequest.isError}
          invitationAccepted={acceptInvitation.isSuccess}
          invitationErrorKey={
            acceptInvitation.isError ? invitationAcceptanceErrorKey(acceptInvitation.error) : null
          }
          isAccepting={acceptInvitation.isPending}
          isCancelling={cancelRequest.isPending}
          isSubmitting={submitRequest.isPending}
          onAccept={(invitationId) => {
            submitRequest.reset();
            cancelRequest.reset();
            acceptInvitation.reset();
            acceptInvitation.mutate(invitationId);
          }}
          onCancel={(requestId) => {
            submitRequest.reset();
            cancelRequest.reset();
            acceptInvitation.reset();
            cancelRequest.mutate(requestId);
          }}
          onSubmit={() => {
            submitRequest.reset();
            cancelRequest.reset();
            acceptInvitation.reset();
            submitRequest.mutate();
          }}
          pendingClubInvitationId={profile.pendingClubInvitationId}
          pendingMembershipRequestId={profile.pendingMembershipRequestId}
          relationship={profile.relationship}
        />

        {profile.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>{t('playerClubs.about')}</Text>
            <Text style={styles.body}>{profile.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{t('playerClubs.contact')}</Text>
          {profile.physicalAddress ? (
            <DetailRow
              icon={MapPin}
              label={t('playerClubs.address')}
              value={profile.physicalAddress}
            />
          ) : null}
          {profile.mapLink ? (
            <DetailRow
              icon={MapPin}
              label={t('playerClubs.openMap')}
              onPress={() => openHttpUrl(profile.mapLink!)}
              value={profile.mapLink}
            />
          ) : null}
          {profile.contactEmail ? (
            <DetailRow
              icon={Mail}
              label={t('playerClubs.email')}
              onPress={() => void Linking.openURL(`mailto:${profile.contactEmail}`)}
              value={profile.contactEmail}
            />
          ) : null}
          {profile.contactPhone ? (
            <DetailRow
              icon={Phone}
              label={t('playerClubs.phone')}
              onPress={() => void Linking.openURL(`tel:${profile.contactPhone}`)}
              value={profile.contactPhone}
            />
          ) : null}
          {profile.timeZone ? (
            <DetailRow icon={MapPin} label={t('playerClubs.timeZone')} value={profile.timeZone} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  logo: {
    width: '100%',
    height: 180,
    borderRadius: radii.lg,
    backgroundColor: colors.secondary,
  },
  heading: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: '800',
  },
  section: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  sectionHeading: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  detailRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  detailCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 21,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  muted: {
    color: colors.muted,
  },
  error: {
    color: colors.destructive,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  backLinkText: {
    color: colors.primary,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
