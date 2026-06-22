'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ClubDrawer } from '@/components/clubs/club-drawer';
import { useArchiveClub, useWorkspaceClub, useWorkspaceMe } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

export default function ClubPage() {
  const clubId = useParams<{ clubId: string }>().clubId;
  const router = useRouter();
  const { data: club, isLoading } = useWorkspaceClub(clubId);
  const { data: me } = useWorkspaceMe();
  const archive = useArchiveClub(clubId);
  const { t } = useLocale();
  if (isLoading || !club)
    return <main className="p-6 text-sm text-muted-foreground">{t('common.loading')}</main>;
  const canManage = me?.platformAdmin || club.role === 'owner';
  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{club.name}</h2>
            <BadgeStatus archived={Boolean(club.archivedAt)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {club.timeZone} · /{club.slug}
          </p>
        </div>
        {canManage && !club.archivedAt && (
          <div className="flex gap-2">
            <ClubDrawer club={club}>
              <Button variant="outline">{t('common.edit')}</Button>
            </ClubDrawer>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">{t('common.archive')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('clubs.archiveTitle')}</DialogTitle>
                  <DialogDescription>{t('clubs.archiveDescription')}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t('common.cancel')}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await archive.mutateAsync();
                          toast.success(t('clubs.archivedMessage'));
                          router.push('/workspace/clubs');
                        } catch {
                          toast.error(t('error.invalidRequest'));
                        }
                      }}
                    >
                      {t('common.archive')}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-primary">
              <Users />
            </div>
            <CardTitle>
              {club.memberCount} {t('clubs.members').toLowerCase()}
            </CardTitle>
            <CardDescription>{t('members.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href={`/workspace/clubs/${clubId}/members`}>
                {t('sidebar.members')}
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function BadgeStatus({ archived }: { archived: boolean }) {
  const { t } = useLocale();
  return (
    <span
      className={
        archived
          ? 'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
          : 'rounded-full bg-brand-soft px-2 py-0.5 text-xs text-primary'
      }
    >
      {archived ? t('clubs.archived') : t('clubs.active')}
    </span>
  );
}
