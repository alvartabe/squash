'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useArchiveClub, useRestoreClub } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

type LifecycleAction = 'archive' | 'restore';

export function clubLifecycleVisibility(input: {
  archivedAt: string | null;
  membershipStatus: string | null;
  responsibilities: readonly string[];
  platformAdmin: boolean;
}) {
  const activeOwner =
    input.membershipStatus === 'active' && input.responsibilities.includes('owner');
  return {
    canArchive: !input.archivedAt && activeOwner,
    canRestore: Boolean(input.archivedAt) && (activeOwner || input.platformAdmin),
  };
}

function errorCode(error: unknown) {
  return (
    error as {
      response?: { data?: { error?: { code?: string } } };
    }
  ).response?.data?.error?.code;
}

export function ClubLifecycleActions({
  clubId,
  archived,
  canArchive,
  canRestore,
  size,
}: {
  clubId: string;
  archived: boolean;
  canArchive: boolean;
  canRestore: boolean;
  size?: 'sm' | 'default';
}) {
  const action: LifecycleAction | null = archived
    ? canRestore
      ? 'restore'
      : null
    : canArchive
      ? 'archive'
      : null;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const archive = useArchiveClub(clubId);
  const restore = useRestoreClub(clubId);
  const { t } = useLocale();
  if (!action) return null;

  const mutation = action === 'archive' ? archive : restore;
  const pending = submitting || mutation.isPending;
  const submit = async () => {
    if (submittingRef.current || mutation.isPending) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await mutation.mutateAsync();
      toast.success(t(action === 'archive' ? 'clubs.archivedMessage' : 'clubs.restoredMessage'));
      setOpen(false);
    } catch (error) {
      const key =
        action === 'archive' && errorCode(error) === 'CLUB_ARCHIVE_ACTIVE_TOURNAMENT'
          ? 'clubs.archiveActiveTournamentError'
          : action === 'archive'
            ? 'clubs.archiveError'
            : 'clubs.restoreError';
      toast.error(t(key));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size={size}>
          {t(action === 'archive' ? 'common.archive' : 'common.restore')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(action === 'archive' ? 'clubs.archiveTitle' : 'clubs.restoreTitle')}
          </DialogTitle>
          <DialogDescription>
            {t(action === 'archive' ? 'clubs.archiveDescription' : 'clubs.restoreDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={action === 'archive' ? 'destructive' : 'default'}
            disabled={pending}
            onClick={submit}
          >
            {pending
              ? t(action === 'archive' ? 'common.archiving' : 'common.restoring')
              : t(action === 'archive' ? 'common.archive' : 'common.restore')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
