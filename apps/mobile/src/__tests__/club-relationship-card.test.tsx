import { fireEvent, render } from '@testing-library/react-native';
import { ClubRelationshipCard } from '@/src/components/club-relationship-card';
import { getClubRelationshipPresentation } from '@/src/lib/club-relationships';
import { t } from '@/src/lib/i18n';

describe('Player Club relationship rendering', () => {
  it.each([
    ['active', null],
    ['suspended', null],
    ['request-pending', 'cancel'],
    ['invited', null],
    ['none', 'submit'],
  ] as const)('renders the documented %s relationship and actions', (relationship, action) => {
    const presentation = getClubRelationshipPresentation(relationship);
    const screen = render(
      <ClubRelationshipCard
        hasMutationError={false}
        isCancelling={false}
        isSubmitting={false}
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
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
  });

  it('allows submission only when there is no relationship', () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ClubRelationshipCard
        hasMutationError={false}
        isCancelling={false}
        isSubmitting={false}
        onCancel={jest.fn()}
        onSubmit={onSubmit}
        pendingMembershipRequestId={null}
        relationship="none"
      />,
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
        hasMutationError={false}
        isCancelling={false}
        isSubmitting={false}
        onCancel={onCancel}
        onSubmit={jest.fn()}
        pendingMembershipRequestId={requestId}
        relationship="request-pending"
      />,
    );

    fireEvent.press(screen.getByText(t('playerClubs.cancelRequest')));
    expect(onCancel).toHaveBeenCalledWith(requestId);
    expect(screen.queryByText(t('playerClubs.requestMembership'))).toBeNull();
  });

  it('prevents another submission while the submission mutation is pending', () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ClubRelationshipCard
        hasMutationError={false}
        isCancelling={false}
        isSubmitting
        onCancel={jest.fn()}
        onSubmit={onSubmit}
        pendingMembershipRequestId={null}
        relationship="none"
      />,
    );

    fireEvent.press(screen.getByText(t('playerClubs.requestingMembership')));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not offer cancellation if a Pending request ID is unavailable', () => {
    const screen = render(
      <ClubRelationshipCard
        hasMutationError={false}
        isCancelling={false}
        isSubmitting={false}
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
        pendingMembershipRequestId={null}
        relationship="request-pending"
      />,
    );

    expect(screen.queryByText(t('playerClubs.cancelRequest'))).toBeNull();
  });
});
