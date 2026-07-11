'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTransferClubOwnership } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

export function OwnershipRecoveryAction({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const transfer = useTransferClubOwnership(clubId);
  const { t } = useLocale();

  const submit = async () => {
    try {
      await transfer.mutateAsync(newOwnerId.trim());
      toast.success(t('clubs.transferOwnershipSuccess'));
      setNewOwnerId('');
      setOpen(false);
    } catch {
      toast.error(t('clubs.transferOwnershipError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{t('members.transfer')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('members.transfer')}</DialogTitle>
          <DialogDescription>{t('clubs.transferOwnershipDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`new-owner-${clubId}`}>{t('clubs.newOwnerId')}</Label>
          <Input
            id={`new-owner-${clubId}`}
            value={newOwnerId}
            onChange={(event) => setNewOwnerId(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!newOwnerId.trim() || transfer.isPending} onClick={submit}>
            {t('members.transfer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
