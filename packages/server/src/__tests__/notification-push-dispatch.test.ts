import { db } from '../database';
import { processOutboxBatch } from '../outbox';

jest.mock('../database', () => ({
  db: { select: jest.fn(), transaction: jest.fn(), update: jest.fn() },
}));

const mockDb = db as unknown as {
  select: jest.Mock;
  transaction: jest.Mock;
  update: jest.Mock;
};

const sessionInvitation = {
  id: 'event-id',
  topic: 'club-play-session.invited',
  aggregateId: 'session-id',
  payload: { recipientId: 'player-id' },
  attempts: 0,
};

function mockClaim(event = sessionInvitation) {
  mockDb.transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) =>
    callback({
      execute: async () => ({ rows: [event] }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    }),
  );
  mockDb.update.mockReturnValue({ set: () => ({ where: async () => undefined }) });
}

function mockSelectWithLimit(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

function mockSelect(rows: unknown[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn(() => ({ where }));
  mockDb.select.mockReturnValueOnce({ from });
}

describe('notification push dispatch', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
  });

  afterEach(() => jest.restoreAllMocks());

  it('filters an existing Club Play Session push at dispatch when its optional category is disabled', async () => {
    mockClaim();
    mockSelectWithLimit([{ social: true, playSessions: false, tournaments: true, clubs: true }]);

    await expect(processOutboxBatch()).resolves.toBe(1);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dispatches an enabled existing push in the recipient locale', async () => {
    mockClaim();
    mockSelectWithLimit([{ social: true, playSessions: true, tournaments: true, clubs: true }]);
    mockSelectWithLimit([{ locale: 'es-419' }]);
    mockSelect([{ token: 'ExponentPushToken[recipient-device]' }]);
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    await expect(processOutboxBatch()).resolves.toBe(1);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify([
          {
            to: 'ExponentPushToken[recipient-device]',
            title: 'Invitación a una Sesión de Juego del Club',
            body: 'Tu Club te invitó a una Sesión de Juego.',
            data: { sessionId: 'session-id' },
          },
        ]),
      }),
    );
  });
});
