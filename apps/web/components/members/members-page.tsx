'use client';

import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { useDebouncedValue } from '@tanstack/react-pacer';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { ClubInvitation, ClubMember, InviteClubRole } from '@squash/contracts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useClubInvitations,
  useClubMembers,
  useRemoveClubMember,
  useResendClubInvitation,
  useRevokeClubInvitation,
  useTransferClubOwnership,
  useUpdateClubMember,
  useWorkspaceClub,
  useWorkspaceMe,
} from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';
import { InviteMemberDrawer } from './invite-member-drawer';

const memberHelper = createColumnHelper<ClubMember>();
const invitationHelper = createColumnHelper<ClubInvitation>();

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function MembersPage({ clubId }: { clubId: string }) {
  const { locale, t } = useLocale();
  const dateLocale = locale === 'es-419' ? es : enUS;
  const [page, setPage] = useState(0);
  const [invitePage, setInvitePage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, { wait: 400 });
  const pageSize = 15;
  const members = useClubMembers(clubId, { page, pageSize, search: debouncedSearch });
  const invitations = useClubInvitations(clubId, {
    page: invitePage,
    pageSize,
    search: debouncedSearch,
  });
  const { data: me } = useWorkspaceMe();
  const { data: club } = useWorkspaceClub(clubId);
  const updateRole = useUpdateClubMember(clubId);
  const removeMember = useRemoveClubMember(clubId);
  const transfer = useTransferClubOwnership(clubId);
  const resend = useResendClubInvitation(clubId);
  const revoke = useRevokeClubInvitation(clubId);
  const roleLabel = useCallback(
    (role: string) => t(`members.${role as 'owner' | 'admin' | 'coach' | 'player'}`),
    [t],
  );

  const memberColumns = useMemo(
    () => [
      memberHelper.accessor('name', {
        header: t('common.name'),
        cell: (info) => (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={info.row.original.image ?? ''} />
              <AvatarFallback>{initials(info.getValue())}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{info.getValue()}</p>
              <p className="text-xs text-muted-foreground">{info.row.original.email}</p>
            </div>
          </div>
        ),
      }),
      memberHelper.accessor('role', {
        header: t('common.role'),
        cell: (info) =>
          info.getValue() === 'owner' || info.row.original.userId === me?.user.id ? (
            <Badge variant="secondary">{roleLabel(info.getValue())}</Badge>
          ) : (
            <Select
              value={info.getValue()}
              onValueChange={async (role) => {
                try {
                  await updateRole.mutateAsync({
                    userId: info.row.original.userId,
                    role: role as InviteClubRole,
                  });
                  toast.success(t('members.roleUpdated'));
                } catch {
                  toast.error(t('error.invalidRequest'));
                }
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['admin', 'coach', 'player'] as const).map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
      }),
      memberHelper.accessor('joinedAt', {
        header: t('members.joined'),
        cell: (info) => format(new Date(info.getValue()), 'PP', { locale: dateLocale }),
      }),
      memberHelper.display({
        id: 'actions',
        header: () => <span className="block text-right">{t('common.actions')}</span>,
        cell: (info) => (
          <div className="flex justify-end gap-2">
            {club?.role === 'owner' &&
              info.row.original.userId !== me?.user.id &&
              info.row.original.role !== 'owner' && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      {t('members.transfer')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('members.transfer')}</DialogTitle>
                      <DialogDescription>{info.row.original.name}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">{t('common.cancel')}</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          onClick={async () => {
                            try {
                              await transfer.mutateAsync(info.row.original.userId);
                              toast.success(t('members.roleUpdated'));
                            } catch {
                              toast.error(t('error.invalidRequest'));
                            }
                          }}
                        >
                          {t('members.transfer')}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            {info.row.original.userId !== me?.user.id && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    {t('members.remove')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('members.removeTitle')}</DialogTitle>
                    <DialogDescription>{t('members.removeDescription')}</DialogDescription>
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
                            await removeMember.mutateAsync(info.row.original.userId);
                            toast.success(t('members.removed'));
                          } catch {
                            toast.error(t('error.invalidRequest'));
                          }
                        }}
                      >
                        {t('members.remove')}
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ),
      }),
    ],
    [club?.role, dateLocale, me?.user.id, removeMember, roleLabel, t, transfer, updateRole],
  );
  const invitationColumns = useMemo(
    () => [
      invitationHelper.accessor('email', {
        header: t('common.email'),
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      invitationHelper.accessor('role', {
        header: t('common.role'),
        cell: (info) => roleLabel(info.getValue()),
      }),
      invitationHelper.accessor('expiresAt', {
        header: t('invites.expires'),
        cell: (info) => format(new Date(info.getValue()), 'PP', { locale: dateLocale }),
      }),
      invitationHelper.display({
        id: 'status',
        header: t('common.status'),
        cell: (info) => {
          const invitation = info.row.original;
          const state = invitation.acceptedAt
            ? 'accepted'
            : invitation.revokedAt
              ? 'revokedStatus'
              : new Date(invitation.expiresAt) < new Date()
                ? 'expired'
                : 'pending';
          return (
            <Badge variant={state === 'pending' ? 'default' : 'secondary'}>
              {t(`invites.${state}`)}
            </Badge>
          );
        },
      }),
      invitationHelper.display({
        id: 'actions',
        header: () => <span className="block text-right">{t('common.actions')}</span>,
        cell: (info) => {
          const invitation = info.row.original;
          const actionable = !invitation.acceptedAt && !invitation.revokedAt;
          return (
            <div className="flex justify-end gap-2">
              {actionable && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resend.isPending}
                  onClick={async () => {
                    try {
                      await resend.mutateAsync({ invitationId: invitation.id, locale });
                      toast.success(t('invites.resent'));
                    } catch {
                      toast.error(t('error.invalidRequest'));
                    }
                  }}
                >
                  {t('invites.resend')}
                </Button>
              )}
              {actionable && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={async () => {
                    try {
                      await revoke.mutateAsync(invitation.id);
                      toast.success(t('invites.revoked'));
                    } catch {
                      toast.error(t('error.invalidRequest'));
                    }
                  }}
                >
                  {t('invites.revoke')}
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [dateLocale, locale, resend, revoke, roleLabel, t],
  );
  const memberTable = useReactTable({
    data: members.data?.items ?? [],
    columns: memberColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  const invitationTable = useReactTable({
    data: invitations.data?.items ?? [],
    columns: invitationColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const renderTable = <T,>(
    table: ReturnType<typeof useReactTable<T>>,
    loading: boolean,
    columnCount: number,
  ) => (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                {t('common.noResults')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
  const pager = (current: number, setCurrent: (page: number) => void, totalPages = 0) => (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={current <= 0}
        onClick={() => setCurrent(Math.max(0, current - 1))}
      >
        {t('common.previous')}
      </Button>
      <span className="self-center text-sm text-muted-foreground">
        {current + 1} / {Math.max(totalPages, 1)}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={!totalPages || current >= totalPages - 1}
        onClick={() => setCurrent(current + 1)}
      >
        {t('common.next')}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="min-w-56 flex-1"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
            setInvitePage(0);
          }}
          placeholder={t('members.searchPlaceholder')}
        />
        <InviteMemberDrawer clubId={clubId}>
          <Button className="w-full sm:w-auto">
            <IconPlus />
            {t('members.invite')}
          </Button>
        </InviteMemberDrawer>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('members.heading')}</CardTitle>
          <CardDescription>{t('members.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderTable(memberTable, members.isLoading, memberColumns.length)}
          {pager(page, setPage, members.data?.totalPages)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('invites.heading')}</CardTitle>
          <CardDescription>{t('invites.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderTable(invitationTable, invitations.isLoading, invitationColumns.length)}
          {pager(invitePage, setInvitePage, invitations.data?.totalPages)}
        </CardContent>
      </Card>
    </div>
  );
}
