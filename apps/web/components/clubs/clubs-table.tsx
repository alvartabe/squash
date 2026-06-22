'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useDebouncedValue } from '@tanstack/react-pacer';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { ClubSummary } from '@squash/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useArchiveClub, useWorkspaceClubs, useWorkspaceMe } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';
import { ClubDrawer } from './club-drawer';

const columnHelper = createColumnHelper<ClubSummary>();

function ClubActions({ club, canManage }: { club: ClubSummary; canManage: boolean }) {
  const archive = useArchiveClub(club.id);
  const { t } = useLocale();
  return (
    <div className="flex justify-end gap-2">
      <Button asChild variant="secondary" size="sm">
        <Link href={`/workspace/clubs/${club.id}`}>{t('clubs.open')}</Link>
      </Button>
      {canManage && !club.archivedAt && (
        <ClubDrawer club={club}>
          <Button variant="outline" size="sm">
            {t('common.edit')}
          </Button>
        </ClubDrawer>
      )}
      {canManage && !club.archivedAt && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              {t('common.archive')}
            </Button>
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
                  disabled={archive.isPending}
                  onClick={async () => {
                    try {
                      await archive.mutateAsync();
                      toast.success(t('clubs.archivedMessage'));
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
      )}
    </div>
  );
}

export function ClubsTable() {
  const { t } = useLocale();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [debouncedSearch] = useDebouncedValue(search, { wait: 400 });
  const { data, isLoading } = useWorkspaceClubs({
    page,
    pageSize,
    search: debouncedSearch,
    includeArchived,
  });
  const { data: me } = useWorkspaceMe();
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('common.name'),
        cell: (info) => (
          <div>
            <p className="font-medium">{info.row.original.name}</p>
            <p className="text-xs text-muted-foreground">/{info.row.original.slug}</p>
          </div>
        ),
      }),
      columnHelper.accessor('timeZone', { header: t('common.timeZone') }),
      columnHelper.accessor('memberCount', { header: t('clubs.members') }),
      columnHelper.accessor('archivedAt', {
        header: t('common.status'),
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="secondary">{t('clubs.archived')}</Badge>
          ) : (
            <Badge>{t('clubs.active')}</Badge>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <span className="block text-right">{t('common.actions')}</span>,
        cell: (info) => (
          <ClubActions
            club={info.row.original}
            canManage={me?.platformAdmin === true || info.row.original.role === 'owner'}
          />
        ),
      }),
    ],
    [me?.platformAdmin, t],
  );
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="min-w-56 flex-1"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder={t('clubs.searchPlaceholder')}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => {
              setIncludeArchived(event.target.checked);
              setPage(0);
            }}
          />
          {t('clubs.includeArchived')}
        </label>
        <ClubDrawer>
          <Button className="w-full sm:w-auto">
            <IconPlus />
            {t('clubs.new')}
          </Button>
        </ClubDrawer>
      </div>
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
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t('common.noResults')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} {t('sidebar.clubs').toLowerCase()}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(0);
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder={t('common.rows')} />
            </SelectTrigger>
            <SelectContent>
              {[10, 15, 25].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            {t('common.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {Math.max(data?.totalPages ?? 0, 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.totalPages || page >= data.totalPages - 1}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
