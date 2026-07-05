import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const platformRole = pgEnum('platform_role', ['user', 'platform-admin']);
export const membershipStatus = pgEnum('membership_status', ['active', 'suspended', 'ended']);
export const membershipRequestStatus = pgEnum('membership_request_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);
export const clubResponsibility = pgEnum('club_responsibility', ['owner', 'admin', 'coach']);
export const friendshipStatus = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'declined',
  'blocked',
]);
export const attendanceStatus = pgEnum('attendance_status', [
  'invited',
  'accepted',
  'declined',
  'withdrawn',
]);
export const challengeStatus = pgEnum('challenge_status', [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'completed',
  'disputed',
]);
export const matchSource = pgEnum('match_source', ['open-play', 'challenge', 'tournament']);
export const matchStatus = pgEnum('match_status', [
  'scheduled',
  'in-progress',
  'completed',
  'disputed',
  'void',
]);
export const tournamentStatus = pgEnum('tournament_status', [
  'draft',
  'registration',
  'group-stage',
  'knockout',
  'completed',
  'cancelled',
]);
export const tournamentStage = pgEnum('tournament_stage', ['group', 'knockout']);
export const seedingMethod = pgEnum('seeding_method', ['random', 'ranking', 'manual']);
export const mediaPurpose = pgEnum('media_purpose', ['avatar', 'racket', 'club-logo']);
export const outboxStatus = pgEnum('outbox_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// Better Auth tables.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: platformRole('role').notNull().default('user'),
  locale: text('locale').notNull().default('en-US'),
  timeZone: text('time_zone').notNull().default('UTC'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('accounts_user_idx').on(table.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

export const playerProfiles = pgTable('player_profiles', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  dominantHand: text('dominant_hand'),
  visibility: text('visibility').notNull().default('shared-clubs'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const clubs = pgTable(
  'clubs',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logoAssetId: uuid('logo_asset_id'),
    description: text('description'),
    physicalAddress: text('physical_address'),
    mapLink: text('map_link'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    timeZone: text('time_zone'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.logoAssetId],
      foreignColumns: [mediaAssets.id],
      name: 'clubs_logo_asset_id_media_assets_id_fk',
    }).onDelete('set null'),
  ],
);

export const clubInvitations = pgTable(
  'club_invitations',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    responsibility: clubResponsibility('responsibility'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedById: text('invited_by_id')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('club_invitations_club_email_idx').on(table.clubId, table.email),
    index('club_invitations_expires_idx').on(table.expiresAt),
    uniqueIndex('club_invitations_pending_email_idx')
      .on(table.clubId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    check(
      'club_invitations_responsibility_check',
      sql`${table.responsibility} is null or ${table.responsibility} in ('admin', 'coach')`,
    ),
  ],
);

export const clubMemberships = pgTable(
  'club_memberships',
  {
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: membershipStatus('status').notNull().default('active'),
    joinedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.clubId, table.userId] }),
    index('club_memberships_user_idx').on(table.userId),
    index('club_memberships_club_status_idx').on(table.clubId, table.status),
  ],
);

export const membershipRequests = pgTable(
  'membership_requests',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: membershipRequestStatus('status').notNull().default('pending'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedById: text('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('membership_requests_club_status_submitted_idx').on(
      table.clubId,
      table.status,
      table.submittedAt,
    ),
    index('membership_requests_player_idx').on(table.playerId),
    uniqueIndex('membership_requests_one_pending_idx')
      .on(table.clubId, table.playerId)
      .where(sql`${table.status} = 'pending'`),
    check(
      'membership_requests_resolution_check',
      sql`(${table.status} = 'pending' and ${table.resolvedAt} is null and ${table.resolvedById} is null)
        or (${table.status} <> 'pending' and ${table.resolvedAt} is not null)`,
    ),
  ],
);

export const clubResponsibilities = pgTable(
  'club_responsibilities',
  {
    clubId: uuid('club_id').notNull(),
    userId: text('user_id').notNull(),
    responsibility: clubResponsibility('responsibility').notNull(),
    assignedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.clubId, table.userId, table.responsibility] }),
    foreignKey({
      columns: [table.clubId, table.userId],
      foreignColumns: [clubMemberships.clubId, clubMemberships.userId],
      name: 'club_responsibilities_membership_fk',
    }).onDelete('cascade'),
    index('club_responsibilities_user_idx').on(table.userId),
    uniqueIndex('club_responsibilities_one_owner_idx')
      .on(table.clubId)
      .where(sql`${table.responsibility} = 'owner'`),
  ],
);

export const friendships = pgTable(
  'friendships',
  {
    id: id(),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: text('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatus('status').notNull().default('pending'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('friendship_pair_idx').on(table.requesterId, table.addresseeId),
    index('friendship_addressee_idx').on(table.addresseeId),
  ],
);

export const playerRackets = pgTable(
  'player_rackets',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    weightGrams: integer('weight_grams'),
    balance: text('balance'),
    stringType: text('string_type'),
    stringTension: real('string_tension'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('player_rackets_user_idx').on(table.userId)],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: id(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    racketId: uuid('racket_id').references(() => playerRackets.id, { onDelete: 'cascade' }),
    purpose: mediaPurpose('purpose').notNull(),
    objectKey: text('object_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    contentLength: integer('content_length').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('media_owner_idx').on(table.ownerId)],
);

export const recurringAvailability = pgTable(
  'recurring_availability',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    startMinute: integer('start_minute').notNull(),
    endMinute: integer('end_minute').notNull(),
    timeZone: text('time_zone').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('availability_user_idx').on(table.userId)],
);

export const availabilityExceptions = pgTable(
  'availability_exceptions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    available: boolean('available').notNull(),
    startMinute: integer('start_minute'),
    endMinute: integer('end_minute'),
    timeZone: text('time_zone').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('availability_exception_user_date_idx').on(table.userId, table.localDate),
  ],
);

export const openPlaySessions = pgTable(
  'open_play_sessions',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    notes: text('notes'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timeZone: text('time_zone').notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('open_play_club_date_idx').on(table.clubId, table.startsAt)],
);

export const openPlayAttendees = pgTable(
  'open_play_attendees',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => openPlaySessions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: attendanceStatus('status').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.userId] })],
);

export const matchRuleSnapshots = pgTable('match_rule_snapshots', {
  id: id(),
  bestOf: integer('best_of').notNull(),
  pointsToWin: integer('points_to_win').notNull(),
  winByTwo: boolean('win_by_two').notNull(),
  createdAt: createdAt(),
});

export const matches = pgTable(
  'matches',
  {
    id: id(),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    source: matchSource('source').notNull(),
    countsForStatistics: boolean('counts_for_statistics').notNull(),
    status: matchStatus('status').notNull().default('scheduled'),
    rulesId: uuid('rules_id')
      .notNull()
      .references(() => matchRuleSnapshots.id),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    submittedById: text('submitted_by_id').references(() => users.id),
    winnerId: text('winner_id').references(() => users.id),
    currentRevision: integer('current_revision').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('matches_club_source_idx').on(table.clubId, table.source)],
);

export const matchParticipants = pgTable(
  'match_participants',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.userId] }),
    uniqueIndex('match_participant_position_idx').on(table.matchId, table.position),
    index('match_participant_user_idx').on(table.userId),
  ],
);

export const matchSets = pgTable(
  'match_sets',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    playerOnePoints: integer('player_one_points').notNull(),
    playerTwoPoints: integer('player_two_points').notNull(),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.setNumber] })],
);

export const matchResultRevisions = pgTable(
  'match_result_revisions',
  {
    id: id(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    submittedById: text('submitted_by_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason'),
    result: jsonb('result').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('match_revision_idx').on(table.matchId, table.revision)],
);

export const openPlayMatches = pgTable('open_play_matches', {
  sessionId: uuid('session_id')
    .notNull()
    .references(() => openPlaySessions.id, { onDelete: 'cascade' }),
  matchId: uuid('match_id')
    .primaryKey()
    .references(() => matches.id, { onDelete: 'cascade' }),
});

export const challenges = pgTable(
  'challenges',
  {
    id: id(),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id')
      .notNull()
      .unique()
      .references(() => matches.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id),
    opponentId: text('opponent_id')
      .notNull()
      .references(() => users.id),
    status: challengeStatus('status').notNull().default('pending'),
    timeZone: text('time_zone').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('challenges_opponent_status_idx').on(table.opponentId, table.status)],
);

export const tournaments = pgTable(
  'tournaments',
  {
    id: id(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    status: tournamentStatus('status').notNull().default('draft'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }).notNull(),
    timeZone: text('time_zone').notNull(),
    groupSize: integer('group_size').notNull(),
    qualifiersPerGroup: integer('qualifiers_per_group').notNull(),
    seedingMethod: seedingMethod('seeding_method').notNull(),
    rulesId: uuid('rules_id')
      .notNull()
      .references(() => matchRuleSnapshots.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('tournaments_club_status_idx').on(table.clubId, table.status)],
);

export const tournamentOrganizers = pgTable(
  'tournament_organizers',
  {
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.tournamentId, table.userId] })],
);

export const tournamentRegistrations = pgTable(
  'tournament_registrations',
  {
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seed: integer('seed'),
    registeredAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.tournamentId, table.userId] })],
);

export const tournamentGroups = pgTable(
  'tournament_groups',
  {
    id: id(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [uniqueIndex('tournament_group_position_idx').on(table.tournamentId, table.position)],
);

export const tournamentGroupMembers = pgTable(
  'tournament_group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => tournamentGroups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seed: integer('seed'),
    finalRank: integer('final_rank'),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);

export const tournamentFixtures = pgTable(
  'tournament_fixtures',
  {
    id: id(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => tournamentGroups.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id')
      .unique()
      .references(() => matches.id, { onDelete: 'set null' }),
    stage: tournamentStage('stage').notNull(),
    round: integer('round').notNull(),
    position: integer('position').notNull(),
    playerOneId: text('player_one_id').references(() => users.id),
    playerTwoId: text('player_two_id').references(() => users.id),
    advancesToFixtureId: uuid('advances_to_fixture_id'),
    advancesToPosition: integer('advances_to_position'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('tournament_fixture_position_idx').on(
      table.tournamentId,
      table.stage,
      table.round,
      table.position,
    ),
  ],
);

export const tournamentAdvancements = pgTable(
  'tournament_advancements',
  {
    id: id(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => tournamentGroups.id),
    groupRank: integer('group_rank').notNull(),
    bracketSeed: integer('bracket_seed').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('tournament_advancement_player_idx').on(table.tournamentId, table.userId),
    uniqueIndex('tournament_advancement_seed_idx').on(table.tournamentId, table.bracketSeed),
  ],
);

const statisticsColumns = () => ({
  matches: integer('matches').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  setsWon: integer('sets_won').notNull().default(0),
  setsLost: integer('sets_lost').notNull().default(0),
  pointsFor: integer('points_for').notNull().default(0),
  pointsAgainst: integer('points_against').notNull().default(0),
  lastMatchAt: timestamp('last_match_at', { withTimezone: true }),
  version: integer('version').notNull().default(0),
  updatedAt: updatedAt(),
});

export const challengeStats = pgTable('challenge_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  ...statisticsColumns(),
});

export const tournamentStats = pgTable('tournament_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  ...statisticsColumns(),
});

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expoPushToken: text('expo_push_token').notNull().unique(),
    platform: text('platform').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('device_token_user_idx').on(table.userId)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    messageKey: text('message_key').notNull(),
    data: jsonb('data')
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index('notification_user_read_idx').on(table.userId, table.readAt)],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: id(),
    topic: text('topic').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: createdAt(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('outbox_pending_idx').on(table.status, table.availableAt)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [index('audit_entity_idx').on(table.entityType, table.entityId)],
);
