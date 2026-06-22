'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { useCreateClub, useUpdateClub } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timeZone: z.string().trim().min(1).max(100),
});
type Values = z.infer<typeof schema>;

export function ClubDrawer({
  club,
  children,
}: {
  club?: { id: string; name: string; slug: string; timeZone: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  const create = useCreateClub();
  const update = useUpdateClub(club?.id ?? '');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: club?.name ?? '',
      slug: club?.slug ?? '',
      timeZone: club?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  useEffect(() => {
    if (open)
      form.reset({
        name: club?.name ?? '',
        slug: club?.slug ?? '',
        timeZone: club?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
  }, [club, form, open]);
  const submit = form.handleSubmit(async (values) => {
    try {
      if (club) {
        await update.mutateAsync({ name: values.name, timeZone: values.timeZone });
        toast.success(t('clubs.updated'));
      } else {
        await create.mutateAsync(values);
        toast.success(t('clubs.created'));
      }
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
          <DrawerTitle>{club ? t('clubForm.editTitle') : t('clubForm.createTitle')}</DrawerTitle>
          <DrawerDescription>{t('clubForm.description')}</DrawerDescription>
        </DrawerHeader>
        <form
          id="club-form"
          onSubmit={submit}
          className="flex flex-col gap-4 overflow-y-auto px-4 pb-4"
        >
          <div className="space-y-2">
            <Label htmlFor="club-name">{t('common.name')}</Label>
            <Input id="club-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-slug">{t('clubForm.slug')}</Label>
            <Input id="club-slug" disabled={Boolean(club)} {...form.register('slug')} />
            <p className="text-xs text-muted-foreground">{t('clubForm.slugHint')}</p>
            {form.formState.errors.slug && (
              <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-timezone">{t('common.timeZone')}</Label>
            <Input
              id="club-timezone"
              placeholder="America/Costa_Rica"
              {...form.register('timeZone')}
            />
            {form.formState.errors.timeZone && (
              <p className="text-xs text-destructive">{form.formState.errors.timeZone.message}</p>
            )}
          </div>
        </form>
        <DrawerFooter>
          <Button form="club-form" type="submit" disabled={create.isPending || update.isPending}>
            {t('common.save')}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">{t('common.cancel')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
