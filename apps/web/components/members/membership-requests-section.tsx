'use client';

import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { useDebouncedValue } from '@tanstack/react-pacer';
import type { MembershipRequest } from '@squash/contracts';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  membershipRequestErrorCode,
  useApproveMembershipRequest,
  usePendingMembershipRequests,
  useRejectMembershipRequest,
} from '@/src/hooks/membership-requests';
import { useLocale } from '@/src/locale-provider';

type Confirmation = {
  decision: 'approve' | 'reject';
  request: MembershipRequest;
};

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function MembershipRequestsSection({
  clubId,
  archived,
}: {
  clubId: string;
  archived: boolean;
}) {
  const { locale, t } = useLocale();
  const dateLocale = locale === 'es-419' ? es : enUS;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const mutationLock = useRef(false);
  const [debouncedSearch] = useDebouncedValue(search, { wait: 400 });
  const pageSize = 15;
  const requests = usePendingMembershipRequests(
    clubId,
    { page, pageSize, search: debouncedSearch },
    true,
  );
  const approve = useApproveMembershipRequest(clubId);
  const reject = useRejectMembershipRequest(clubId);
  const mutationRunning = approve.isPending || reject.isPending;

  const confirmDecision = async () => {
    if (!confirmation || mutationRunning || mutationLock.current) return;
    mutationLock.current = true;
    try {
      if (confirmation.decision === 'approve') {
        await approve.mutateAsync(confirmation.request.id);
        toast.success(t('membershipRequests.approvedMessage'));
      } else {
        await reject.mutateAsync(confirmation.request.id);
        toast.success(t('membershipRequests.rejectedMessage'));
      }
      if ((requests.data?.items.length ?? 0) === 1 && page > 0) setPage(page - 1);
      setConfirmation(null);
    } catch (error) {
      toast.error(
        membershipRequestErrorCode(error) === 'MEMBERSHIP_REQUEST_NOT_PENDING'
          ? t('membershipRequests.noLongerPending')
          : t('membershipRequests.mutationError'),
      );
    } finally {
      mutationLock.current = false;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('membershipRequests.heading')}</CardTitle>
          <CardDescription>
            {archived
              ? t('membershipRequests.archivedDescription')
              : t('membershipRequests.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={t('membershipRequests.searchPlaceholder')}
            aria-label={t('membershipRequests.searchLabel')}
          />
          {requests.isError ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center">
              <p className="text-sm text-muted-foreground">{t('membershipRequests.loadError')}</p>
              <Button variant="outline" size="sm" onClick={() => void requests.refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('membershipRequests.player')}</TableHead>
                    <TableHead>{t('membershipRequests.submitted')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>
                      <span className="block text-right">{t('common.actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  ) : requests.data?.items.length ? (
                    requests.data.items.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={request.playerImage ?? ''} />
                              <AvatarFallback>{initials(request.playerName)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{request.playerName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.submittedAt), 'PPp', { locale: dateLocale })}
                        </TableCell>
                        <TableCell>
                          <Badge>{t('membershipRequests.pending')}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={archived || mutationRunning}
                              onClick={() => setConfirmation({ decision: 'approve', request })}
                            >
                              {t('membershipRequests.approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={archived || mutationRunning}
                              onClick={() => setConfirmation({ decision: 'reject', request })}
                            >
                              {t('membershipRequests.reject')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {search
                          ? t('membershipRequests.noSearchResults')
                          : t('membershipRequests.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {!requests.isError && (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 0 || requests.isFetching}
                onClick={() => setPage(Math.max(0, page - 1))}
              >
                {t('common.previous')}
              </Button>
              <span className="self-center text-sm text-muted-foreground">
                {page + 1} / {Math.max(requests.data?.totalPages ?? 0, 1)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  requests.isFetching ||
                  !requests.data?.totalPages ||
                  page >= requests.data.totalPages - 1
                }
                onClick={() => setPage(page + 1)}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !mutationRunning) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation?.decision === 'approve'
                ? t('membershipRequests.approveTitle')
                : t('membershipRequests.rejectTitle')}
            </DialogTitle>
            <DialogDescription>
              {confirmation?.decision === 'approve'
                ? t('membershipRequests.approveDescription')
                : t('membershipRequests.rejectDescription')}{' '}
              {confirmation?.request.playerName}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutationRunning}
              onClick={() => setConfirmation(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant={confirmation?.decision === 'reject' ? 'destructive' : 'default'}
              disabled={mutationRunning}
              onClick={() => void confirmDecision()}
            >
              {mutationRunning
                ? t('membershipRequests.updating')
                : confirmation?.decision === 'approve'
                  ? t('membershipRequests.approve')
                  : t('membershipRequests.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
