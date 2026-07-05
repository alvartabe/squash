import type { ClubDiscoveryRelationship } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getClubRelationshipPresentation } from '@/src/lib/club-relationships';
import { t } from '@/src/lib/i18n';

export function ClubRelationshipBadge({
  relationship,
}: {
  relationship: ClubDiscoveryRelationship;
}) {
  const presentation = getClubRelationshipPresentation(relationship);
  return (
    <View
      accessibilityLabel={t(presentation.labelKey)}
      style={[styles.badge, relationship === 'suspended' ? styles.warningBadge : undefined]}
    >
      <Text style={styles.badgeText}>{t(presentation.labelKey)}</Text>
    </View>
  );
}

export function ClubRelationshipCard({
  relationship,
  pendingMembershipRequestId,
  isSubmitting,
  isCancelling,
  hasMutationError,
  onSubmit,
  onCancel,
}: {
  relationship: ClubDiscoveryRelationship;
  pendingMembershipRequestId: string | null;
  isSubmitting: boolean;
  isCancelling: boolean;
  hasMutationError: boolean;
  onSubmit: () => void;
  onCancel: (requestId: string) => void;
}) {
  const presentation = getClubRelationshipPresentation(relationship);
  const busy = isSubmitting || isCancelling;

  return (
    <View style={styles.card}>
      <ClubRelationshipBadge relationship={relationship} />
      <Text style={styles.description}>{t(presentation.descriptionKey)}</Text>
      {presentation.action === 'submit' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isSubmitting, disabled: busy }}
          disabled={busy}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed && !busy ? styles.pressed : undefined,
            busy ? styles.disabled : undefined,
          ]}
        >
          {isSubmitting ? <ActivityIndicator color={colors.primaryForeground} /> : null}
          <Text style={styles.primaryButtonText}>
            {t(isSubmitting ? 'playerClubs.requestingMembership' : 'playerClubs.requestMembership')}
          </Text>
        </Pressable>
      ) : null}
      {presentation.action === 'cancel' && pendingMembershipRequestId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isCancelling, disabled: busy }}
          disabled={busy}
          onPress={() => onCancel(pendingMembershipRequestId)}
          style={({ pressed }) => [
            styles.button,
            styles.cancelButton,
            pressed && !busy ? styles.pressed : undefined,
            busy ? styles.disabled : undefined,
          ]}
        >
          {isCancelling ? <ActivityIndicator color={colors.destructive} /> : null}
          <Text style={styles.cancelButtonText}>
            {t(isCancelling ? 'playerClubs.cancellingRequest' : 'playerClubs.cancelRequest')}
          </Text>
        </Pressable>
      ) : null}
      {hasMutationError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('playerClubs.mutationError')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  warningBadge: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  description: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    color: colors.destructive,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    color: colors.destructive,
    lineHeight: 20,
  },
});
