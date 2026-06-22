import { ClubInvitationCard } from '@/components/auth/club-invitation-card';

export default async function ClubInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClubInvitationCard token={token} />;
}
