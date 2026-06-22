'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { InviteClubRole } from '@squash/contracts';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInviteClubMember } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

const schema = z.object({ email: z.email(), role: z.enum(['admin', 'coach', 'player']) });
type Values = z.infer<typeof schema>;

export function InviteMemberDrawer({
  clubId,
  children,
}: {
  clubId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { locale, t } = useLocale();
  const mutation = useInviteClubMember(clubId);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'player' },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({ ...values, role: values.role as InviteClubRole, locale });
      toast.success(t('invites.sent'));
      form.reset();
      setOpen(false);
    } catch {
      toast.error(t('error.invalidRequest'));
    }
  });
  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('members.invite')}</DrawerTitle>
          <DrawerDescription>{t('invites.description')}</DrawerDescription>
        </DrawerHeader>
        <form id="invite-form" className="flex flex-col gap-4 px-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t('common.email')}</Label>
            <Input id="invite-email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('invites.role')}</Label>
            <Select
              value={form.watch('role')}
              onValueChange={(value) => form.setValue('role', value as InviteClubRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['admin', 'coach', 'player'] as const).map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`members.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
        <DrawerFooter>
          <Button form="invite-form" type="submit" disabled={mutation.isPending}>
            {t('members.invite')}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">{t('common.cancel')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
