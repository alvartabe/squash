import { z } from 'zod';

export const idSchema = z.uuid();
export const userIdSchema = z.string().trim().min(1).max(128);
export const localeSchema = z.enum(['en-US', 'es-419']);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const bestOfSchema = z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]);

export const matchRulesSchema = z.object({
  bestOf: bestOfSchema,
  pointsToWin: z.number().int().min(1).max(99),
  winByTwo: z.boolean(),
});

export const setScoreSchema = z.object({
  playerOnePoints: z.number().int().nonnegative(),
  playerTwoPoints: z.number().int().nonnegative(),
});

export const submitMatchResultSchema = z.object({
  sets: z.array(setScoreSchema).min(1).max(7),
  revisionReason: z.string().trim().max(500).optional(),
});

export const createChallengeSchema = z.object({
  clubId: idSchema.optional(),
  opponentId: userIdSchema,
  scheduledAt: isoDateTimeSchema,
  timeZone: z.string().trim().min(1).max(100),
  rules: matchRulesSchema,
});

export const challengeStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'completed',
  'disputed',
]);
export const respondToChallengeSchema = z.object({ accept: z.boolean() });
export const cancelChallengeSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export const disputeChallengeSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const attendanceStatusSchema = z.enum(['invited', 'accepted', 'declined', 'withdrawn']);
export const updateAttendanceSchema = z.object({
  status: z.enum(['accepted', 'declined', 'withdrawn']),
});

export const createOpenPlaySessionSchema = z.object({
  clubId: idSchema,
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  timeZone: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).optional(),
});

export const seedingMethodSchema = z.enum(['random', 'ranking', 'manual']);

export const createTournamentSchema = z
  .object({
    clubId: idSchema,
    name: z.string().trim().min(1).max(160),
    startsAt: isoDateTimeSchema,
    registrationClosesAt: isoDateTimeSchema,
    timeZone: z.string().trim().min(1).max(100),
    groupSize: z.number().int().min(2).max(32),
    qualifiersPerGroup: z.number().int().min(1).max(16),
    seedingMethod: seedingMethodSchema,
    rules: matchRulesSchema,
  })
  .superRefine((value, context) => {
    if (value.qualifiersPerGroup >= value.groupSize) {
      context.addIssue({
        code: 'custom',
        path: ['qualifiersPerGroup'],
        message: 'Qualifiers must be fewer than the group size',
      });
    }
  });

export const recurringAvailabilitySchema = z
  .object({
    clubId: idSchema.optional(),
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    timeZone: z.string().trim().min(1).max(100),
  })
  .refine((value) => value.endMinute > value.startMinute, {
    path: ['endMinute'],
    message: 'End time must be after start time',
  });

export const equipmentSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  weightGrams: z.number().int().min(50).max(400).optional(),
  balance: z.enum(['head-light', 'even', 'head-heavy']).optional(),
  stringType: z.string().trim().max(120).optional(),
  stringTension: z.number().positive().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const clubProfileFields = {
  name: z.string().trim().min(2).max(120),
  logoAssetId: idSchema.nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  physicalAddress: z.string().trim().min(1).max(500),
  mapLink: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'https:' || protocol === 'http:';
      } catch {
        return false;
      }
    }, 'Map link must use HTTP or HTTPS')
    .nullable()
    .optional(),
  contactEmail: z.string().trim().email().max(320).nullable().optional(),
  contactPhone: z.string().trim().min(1).max(50).nullable().optional(),
  timeZone: z.string().trim().min(1).max(100).nullable().optional(),
};

function requireClubContact(
  value: {
    contactEmail?: string | null | undefined;
    contactPhone?: string | null | undefined;
  },
  context: z.RefinementCtx,
) {
  if (!value.contactEmail && !value.contactPhone) {
    context.addIssue({
      code: 'custom',
      path: ['contactEmail'],
      message: 'A contact email or contact phone is required',
    });
  }
}

export const clubProfileInputSchema = z.object(clubProfileFields).superRefine(requireClubContact);

export const createClubSchema = z
  .object({
    ...clubProfileFields,
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    initialOwnerId: userIdSchema,
  })
  .superRefine(requireClubContact);

export const updateClubSchema = clubProfileInputSchema;

export const membershipStatusSchema = z.enum(['active', 'suspended', 'ended']);
export const clubDiscoveryRelationshipSchema = z.enum([
  'active',
  'suspended',
  'request-pending',
  'invited',
  'none',
]);
export const membershipRequestStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);
export const clubResponsibilitySchema = z.enum(['owner', 'admin', 'coach']);
export const inviteClubResponsibilitySchema = z.enum(['admin', 'coach']).nullable();
export const clubResponsibilitiesSchema = z
  .array(clubResponsibilitySchema)
  .max(3)
  .refine((items) => new Set(items).size === items.length, {
    message: 'Club responsibilities must be unique',
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().trim().max(120).default(''),
});

export const membershipRequestListQuerySchema = paginationQuerySchema.extend({
  status: membershipRequestStatusSchema.optional(),
});

export const clubListQuerySchema = paginationQuerySchema.extend({
  includeArchived: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .default(false)
    .transform((value) => value === true || value === 'true'),
});

export const inviteClubMemberSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((value) => value.trim().toLowerCase()),
  responsibility: inviteClubResponsibilitySchema,
  locale: localeSchema.default('en-US'),
});

export const updateClubMemberSchema = z
  .object({
    status: membershipStatusSchema.optional(),
    responsibilities: clubResponsibilitiesSchema.optional(),
  })
  .refine((input) => input.status !== undefined || input.responsibilities !== undefined, {
    message: 'A membership change is required',
  });
export const transferClubOwnershipSchema = z.object({ userId: userIdSchema });

export const clubSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  timeZone: z.string().nullable(),
  membershipStatus: membershipStatusSchema.nullable(),
  responsibilities: clubResponsibilitiesSchema,
  memberCount: z.number().int().nonnegative(),
  archivedAt: z.string().nullable(),
});

export const clubDiscoveryItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  timeZone: z.string().nullable(),
  relationship: clubDiscoveryRelationshipSchema,
});

export const clubProfileDetailSchema = z.object({
  id: idSchema,
  name: z.string(),
  logoUrl: z.string().url().nullable(),
  description: z.string().nullable(),
  physicalAddress: z.string().nullable(),
  mapLink: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  timeZone: z.string().nullable(),
  relationship: clubDiscoveryRelationshipSchema,
  pendingMembershipRequestId: idSchema.nullable(),
  pendingClubInvitationId: idSchema.nullable(),
});

export const clubMemberSchema = z.object({
  userId: userIdSchema,
  name: z.string(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  membershipStatus: membershipStatusSchema,
  responsibilities: clubResponsibilitiesSchema,
  joinedAt: z.string(),
});

export const clubInvitationSchema = z.object({
  id: idSchema,
  clubId: idSchema,
  email: z.email(),
  responsibility: inviteClubResponsibilitySchema,
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const membershipRequestSchema = z.object({
  id: idSchema,
  clubId: idSchema,
  playerId: userIdSchema,
  playerName: z.string(),
  playerImage: z.string().nullable(),
  status: membershipRequestStatusSchema,
  submittedAt: z.string(),
  resolvedAt: z.string().nullable(),
  resolvedById: userIdSchema.nullable(),
});

export type PaginatedData<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ClubSummary = z.infer<typeof clubSummarySchema>;
export type ClubDiscoveryItem = z.infer<typeof clubDiscoveryItemSchema>;
export type ClubDiscoveryRelationship = z.infer<typeof clubDiscoveryRelationshipSchema>;
export type ClubProfileDetail = z.infer<typeof clubProfileDetailSchema>;
export type ClubMember = z.infer<typeof clubMemberSchema>;
export type ClubInvitation = z.infer<typeof clubInvitationSchema>;
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;
export type MembershipRequest = z.infer<typeof membershipRequestSchema>;
export type MembershipRequestStatus = z.infer<typeof membershipRequestStatusSchema>;
export type ClubResponsibility = z.infer<typeof clubResponsibilitySchema>;
export type InviteClubResponsibility = z.infer<typeof inviteClubResponsibilitySchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(1000).nullable().optional(),
  dominantHand: z.enum(['left', 'right', 'ambidextrous']).nullable().optional(),
  visibility: z.enum(['private', 'friends', 'shared-clubs']).default('shared-clubs'),
  locale: localeSchema,
  timeZone: z.string().trim().min(1).max(100),
});

export const friendRequestSchema = z.object({ addresseeId: idSchema.or(z.string().min(1)) });
export const friendResponseSchema = z.object({
  status: z.enum(['accepted', 'declined', 'blocked']),
});

export const deviceTokenSchema = z.object({
  expoPushToken: z.string().trim().startsWith('ExponentPushToken[').max(255),
  platform: z.enum(['ios', 'android']),
});

export const statisticsSchema = z.object({
  matches: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(1),
  setsWon: z.number().int().nonnegative(),
  setsLost: z.number().int().nonnegative(),
  pointsFor: z.number().int().nonnegative(),
  pointsAgainst: z.number().int().nonnegative(),
});

export const playerStatisticsSchema = z.object({
  challenge: statisticsSchema,
  tournament: statisticsSchema,
});

export const presignUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  purpose: z.enum(['avatar', 'racket', 'club-logo']),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    messageKey: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
    requestId: z.string(),
  }),
});

export const apiDataSchema = <T extends z.ZodType>(schema: T) => z.object({ data: schema });

export type MatchRulesInput = z.infer<typeof matchRulesSchema>;
export type SetScoreInput = z.infer<typeof setScoreSchema>;
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
export type UpdateClubInput = z.infer<typeof updateClubSchema>;
export type CreateOpenPlaySessionInput = z.infer<typeof createOpenPlaySessionSchema>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type RecurringAvailabilityInput = z.infer<typeof recurringAvailabilitySchema>;
export type PlayerStatistics = z.infer<typeof playerStatisticsSchema>;
