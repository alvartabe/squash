import type { ClubDiscoveryRelationship } from '@squash/contracts';
import type { MessageKey } from '@squash/i18n';

export type ClubRelationshipAction = 'submit' | 'cancel' | 'accept' | null;

export type ClubRelationshipPresentation = {
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  action: ClubRelationshipAction;
};

export function getClubRelationshipPresentation(
  relationship: ClubDiscoveryRelationship,
): ClubRelationshipPresentation {
  switch (relationship) {
    case 'active':
      return {
        labelKey: 'playerClubs.relationship.active',
        descriptionKey: 'playerClubs.relationship.activeDescription',
        action: null,
      };
    case 'suspended':
      return {
        labelKey: 'playerClubs.relationship.suspended',
        descriptionKey: 'playerClubs.relationship.suspendedDescription',
        action: null,
      };
    case 'request-pending':
      return {
        labelKey: 'playerClubs.relationship.requestPending',
        descriptionKey: 'playerClubs.relationship.requestPendingDescription',
        action: 'cancel',
      };
    case 'invited':
      return {
        labelKey: 'playerClubs.relationship.invited',
        descriptionKey: 'playerClubs.relationship.invitedDescription',
        action: 'accept',
      };
    case 'none':
      return {
        labelKey: 'playerClubs.relationship.none',
        descriptionKey: 'playerClubs.relationship.noneDescription',
        action: 'submit',
      };
  }
}
