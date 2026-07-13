import { fireEvent, render, screen } from '@testing-library/react';
import type { AuditRecord, AuditRecordPage } from '@squash/contracts';
import type { Locale } from '@squash/i18n';
import { AuditIndex } from './audit-index';

let mockLocale: Locale = 'en-US';
let mockQuery: ReturnType<typeof queryResult>;

jest.mock('@/src/locale-provider', () => {
  const { translate } = jest.requireActual('@squash/i18n') as typeof import('@squash/i18n');
  return {
    useLocale: () => ({
      locale: mockLocale,
      t: (key: Parameters<typeof translate>[1]) => translate(mockLocale, key),
    }),
  };
});

jest.mock('@/src/hooks/audit', () => ({
  usePlatformAuditRecords: () => mockQuery,
}));

const firstRecord = {
  id: '91f6704a-c62c-4676-93a1-72d5b3fd6b7a',
  createdAt: '2026-07-12T15:00:00.123Z',
  action: 'club.archived',
  actorId: null,
  entityType: 'club',
  entityId: '6ed6b0ac-c7a6-4c64-9d20-496f18f901ab',
  clubId: null,
  metadata: { email: 'private@example.com' },
} as AuditRecord & { metadata: { email: string } };

const secondRecord: AuditRecord = {
  id: '3af4769c-689a-4d41-874f-d0f2c8151e32',
  createdAt: '2026-07-11T15:00:00.000Z',
  action: 'official-result.corrected',
  actorId: 'actor-id',
  entityType: 'match',
  entityId: 'match-id',
  clubId: 'fbd59355-fbaa-4d4b-aee4-568945f2ad6b',
};

function page(items: AuditRecord[] = [], nextCursor: string | null = null): AuditRecordPage {
  return { items, nextCursor };
}

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [page()], pageParams: [null] },
    isError: false,
    isFetchingNextPage: false,
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    ...overrides,
  };
}

describe('Platform Administrator audit index', () => {
  beforeEach(() => {
    mockLocale = 'en-US';
    mockQuery = queryResult();
  });

  it('renders only the approved fields and handles missing actor and Club references safely', () => {
    mockQuery = queryResult({ data: { pages: [page([firstRecord])], pageParams: [null] } });

    render(<AuditIndex />);

    expect(screen.getByRole('table', { name: 'Platform audit records' })).toBeInTheDocument();
    for (const heading of [
      'Created',
      'Action code',
      'Actor ID',
      'Entity type',
      'Entity ID',
      'Club ID',
      'Audit record ID',
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('club.archived')).toBeInTheDocument();
    expect(screen.getByText(firstRecord.entityId)).toBeInTheDocument();
    expect(screen.getByText(firstRecord.id)).toBeInTheDocument();
    expect(screen.getAllByText('Not recorded')).toHaveLength(2);
    expect(screen.queryByText('private@example.com')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('metadata');
    expect(screen.queryByRole('button', { name: /edit|delete|archive/i })).not.toBeInTheDocument();
  });

  it('provides loading, empty, and retryable error states', () => {
    mockQuery = queryResult({ data: undefined, isLoading: true });
    const view = render(<AuditIndex />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');

    mockQuery = queryResult();
    view.rerender(<AuditIndex />);
    expect(screen.getByText('No audit records are available.')).toBeInTheDocument();

    const refetch = jest.fn();
    mockQuery = queryResult({ data: undefined, isError: true, refetch });
    view.rerender(<AuditIndex />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Audit records could not be loaded. Check your connection and try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders accumulated pages and supports the additional-page loading state', () => {
    const fetchNextPage = jest.fn();
    mockQuery = queryResult({
      data: {
        pages: [page([firstRecord], 'next-page'), page([secondRecord])],
        pageParams: [null, 'next-page'],
      },
      hasNextPage: true,
      fetchNextPage,
    });
    const view = render(<AuditIndex />);

    expect(screen.getByText('2 audit records loaded')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more audit records' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    mockQuery = queryResult({
      data: { pages: [page([firstRecord], 'next-page')], pageParams: [null] },
      hasNextPage: true,
      isFetchingNextPage: true,
    });
    view.rerender(<AuditIndex />);
    expect(screen.getByRole('button', { name: 'Load more audit records' })).toBeDisabled();
    expect(screen.getByText('Loading more audit records…')).toBeInTheDocument();
  });

  it('provides Latin American Spanish copy while leaving action codes and identifiers unchanged', () => {
    mockLocale = 'es-419';
    mockQuery = queryResult({
      data: { pages: [page([firstRecord], 'next-page')], pageParams: [null] },
      hasNextPage: true,
    });

    render(<AuditIndex />);

    expect(screen.getByRole('heading', { name: 'Registros de auditoría' })).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Registros de auditoría de la plataforma' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Código de acción' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ID del actor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar más registros de auditoría' })).toBeEnabled();
    expect(screen.getByText('club.archived')).toBeInTheDocument();
    expect(screen.getByText(firstRecord.id)).toBeInTheDocument();
    expect(screen.getAllByText('No registrado')).toHaveLength(2);
  });
});
