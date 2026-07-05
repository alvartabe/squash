import { fireEvent, render } from '@testing-library/react-native';
import { ClubRelationshipCard } from '@/src/components/club-relationship-card';
import { getClubRelationshipPresentation } from '@/src/lib/club-relationships';
import { t } from '@/src/lib/i18n';

const defaultProps = {
  hasMutationError: false,
  invitationAccepted: false,
  invitationErrorKey: null,
  isAccepting: false,
  isCancelling: false,
  isSubmitting: false,
  onAccept: jest.fn(),
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
  pendingClubInvitationId: null,
  pendingMembershipRequestId: null,
} as const;

describe('Player Club relationship rendering', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['active', null],
    ['suspended', null],
    ['request-pending', 'cancel'],
    ['invited', 'accept'],
    ['none', 'submit'],
  ] as const)('renders the documented %s relationship and actions', (relationship, action) => {
    const presentation = getClubRelationshipPresentation(relationship);
    const screen = render(
      <ClubRelationshipCard
        {...defaultProps}
        pendingClubInvitationId={
          relationship === 'invited' ? 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35' : null
        }
        pendingMembershipRequestId={
          relationship === 'request-pending' ? '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c' : null
        }
        relationship={relationship}
      />,
    );

    expect(screen.getByText(t(presentation.labelKey))).toBeTruthy();
    expect(screen.getByText(t(presentation.descriptionKey))).toBeTruthy();
    expect(presentation.action).toBe(action);
    expect(Boolean(screen.queryByText(t('playerClubs.requestMembership')))).toBe(
      action === 'submit',
    );
    expect(Boolean(screen.queryByText(t('playerClubs.cancelRequest')))).toBe(action === 'cancel');
    expect(Boolean(screen.queryByText(t('playerClubs.acceptInvitation')))).toBe(
      action === 'accept',
    );
  });

  it('allows submission only when there is no relationship', () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ClubRelationshipCard {...defaultProps} onSubmit={onSubmit} relationship="none" />,
    );

    fireEvent.press(screen.getByText(t('playerClubs.requestMembership')));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t('playerClubs.cancelRequest'))).toBeNull();
  });

  it('allows cancellation only with the authenticated Player pending request ID', () => {
    const onCancel = jest.fn();
    const requestId = '2a9e01c1-f2ca-4f66-88ca-3fdd5349c46c';
    const screen = render(
      <ClubRelationshipCard
        {...defaultProps}
        onCancel={onCancel}
        pendingMembershipRequestId={requestId}
        relationship="request-pending"
      />,
    );

    fireEvent.press(screen.getByText(t('playerClubs.cancelRequest')));
    expect(onCancel).toHaveBeenCalledWith(requestId);
    expect(screen.queryByText(t('playerClubs.requestMembership'))).toBeNull();
  });

  it('accepts only the authenticated Player pending Club Invitation ID', () => {
    const onAccept = jest.fn();
    const invitationId = 'a1e38c8c-17d9-42f3-9a19-33c45f76eb35';
    const screen = render(
      <ClubRelationshipCard
        {...defaultProps}
        onAccept={onAccept}
        pendingClubInvitationId={invitationId}
        relationship="invited"
      />,
    );

    fireEvent.press(screen.getByText(t('playerClubs.acceptInvitation')));
    expect(onAccept).toHaveBeenCalledWith(invitationId);
  });

  it('shows invitation loading and prevents duplicate acceptance', () => {
    const onAccept = jest.fn();
    const screen = render(
      <ClubRelationshipCard
        {...defaultProps}
        isAccepting
        onAccept={onAccept}
        pendingClubInvitationId="a1e38c8c-17d9-42f3-9a19-33c45f76eb35"
        relationship="invited"
      />,
    );

    fireEvent.press(screen.getByText(t('playerClubs.acceptingInvitation')));
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });

  it('shows localized invitation success and failure states', () => {
    const success = render(
      <ClubRelationshipCard
        {...defaultProps}
        invitationAccepted
        pendingClubInvitationId="a1e38c8c-17d9-42f3-9a19-33c45f76eb35"
        relationship="active"
      />,
    );
    expect(success.getByText(t('playerClubs.invitationAccepted'))).toBeTruthy();
    expect(success.getByText(t('playerClubs.relationship.active'))).toBeTruthy();
    expect(success.getByText(t('playerClubs.relationship.activeDescription'))).toBeTruthy();

    const failure = render(
      <ClubRelationshipCard
        {...defaultProps}
        invitationErrorKey="playerClubs.invitationExpired"
        pendingClubInvitationId="a1e38c8c-17d9-42f3-9a19-33c45f76eb35"
        relationship="invited"
      />,
    );
    expect(failure.getByText(t('playerClubs.invitationExpired'))).toBeTruthy();
  });

  it('prevents another submission while the submission mutation is pending', () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ClubRelationshipCard
        {...defaultProps}
        isSubmitting
        onSubmit={onSubmit}
        relationship="none"
      />,
    );

    fireEvent.press(screen.getByText(t('playerClubs.requestingMembership')));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not offer an action if its authenticated Player identifier is unavailable', () => {
    const request = render(
      <ClubRelationshipCard {...defaultProps} relationship="request-pending" />,
    );
    expect(request.queryByText(t('playerClubs.cancelRequest'))).toBeNull();

    const invitation = render(<ClubRelationshipCard {...defaultProps} relationship="invited" />);
    expect(invitation.queryByText(t('playerClubs.acceptInvitation'))).toBeNull();
  });
});
