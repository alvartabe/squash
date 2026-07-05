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
import {
  useCreateClub,
  useUpdateClub,
  useWorkspaceClub,
  type ClubDetails,
} from '@/src/hooks/workspace';
import { api } from '@/src/lib/api';
import { useLocale } from '@/src/locale-provider';

const schema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(2000),
    physicalAddress: z.string().trim().min(1).max(500),
    mapLink: z.union([z.literal(''), z.string().trim().url().max(2048)]),
    contactEmail: z.union([z.literal(''), z.string().trim().email().max(320)]),
    contactPhone: z.string().trim().max(50),
    timeZone: z.string().trim().max(100),
    initialOwnerId: z.string().trim().max(128),
  })
  .superRefine((value, context) => {
    if (!value.contactEmail && !value.contactPhone) {
      context.addIssue({
        code: 'custom',
        path: ['contactEmail'],
        message: 'A contact email or contact phone is required',
      });
    }
  });
type Values = z.infer<typeof schema>;

function defaults(club?: ClubDetails): Values {
  return {
    name: club?.name ?? '',
    slug: club?.slug ?? '',
    description: club?.description ?? '',
    physicalAddress: club?.physicalAddress ?? '',
    mapLink: club?.mapLink ?? '',
    contactEmail: club?.contactEmail ?? '',
    contactPhone: club?.contactPhone ?? '',
    timeZone: club?.timeZone ?? '',
    initialOwnerId: '',
  };
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

async function uploadLogo(file: File) {
  const response = await api.post('/media/uploads', {
    fileName: file.name,
    contentType: file.type,
    contentLength: file.size,
    purpose: 'club-logo',
  });
  const upload = response.data.data as { assetId?: string; uploadUrl: string };
  if (!upload.assetId) throw new Error('Logo asset was not created.');
  const result = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!result.ok) throw new Error('Logo upload failed.');
  return upload.assetId;
}

export function ClubDrawer({
  club,
  children,
}: {
  club?: { id: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const { t } = useLocale();
  const { data: details, isLoading: isLoadingClub } = useWorkspaceClub(club?.id ?? '');
  const create = useCreateClub();
  const update = useUpdateClub(club?.id ?? '');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaults(details));
    setLogoFile(null);
    setRemoveLogo(false);
  }, [details, form, open]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (club && !details) return;
      const initialOwnerId = values.initialOwnerId.trim();
      if (!club && !initialOwnerId) {
        form.setError('initialOwnerId', { message: t('clubForm.initialOwnerRequired') });
        return;
      }
      const logoAssetId = logoFile
        ? await uploadLogo(logoFile)
        : removeLogo
          ? null
          : (details?.logoAssetId ?? null);
      const profile = {
        name: values.name,
        logoAssetId,
        description: optional(values.description),
        physicalAddress: values.physicalAddress,
        mapLink: optional(values.mapLink),
        contactEmail: optional(values.contactEmail),
        contactPhone: optional(values.contactPhone),
        timeZone: optional(values.timeZone),
      };

      if (club) {
        await update.mutateAsync(profile);
        toast.success(t('clubs.updated'));
      } else {
        await create.mutateAsync({
          ...profile,
          slug: values.slug,
          initialOwnerId,
        });
        toast.success(t('clubs.created'));
      }
      setOpen(false);
    } catch {
      toast.error(t('error.invalidRequest'));
    }
  });

  const pending = create.isPending || update.isPending;
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
          <Field label={t('common.name')} error={form.formState.errors.name?.message}>
            <Input id="club-name" {...form.register('name')} />
          </Field>
          {!club && (
            <Field
              label={t('clubForm.slug')}
              hint={t('clubForm.slugHint')}
              error={form.formState.errors.slug?.message}
            >
              <Input id="club-slug" {...form.register('slug')} />
            </Field>
          )}
          <Field label={t('clubForm.logo')} hint={t('clubForm.logoHint')}>
            {details?.logoUrl && !removeLogo && !logoFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={details.logoUrl}
                alt=""
                className="mb-2 size-20 rounded-lg border object-cover"
              />
            )}
            <Input
              id="club-logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setLogoFile(event.target.files?.[0] ?? null);
                setRemoveLogo(false);
              }}
            />
            {details?.logoAssetId && !removeLogo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setLogoFile(null);
                  setRemoveLogo(true);
                }}
              >
                {t('clubForm.removeLogo')}
              </Button>
            )}
          </Field>
          <Field
            label={t('clubForm.descriptionLabel')}
            error={form.formState.errors.description?.message}
          >
            <textarea
              id="club-description"
              className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              {...form.register('description')}
            />
          </Field>
          <Field
            label={t('clubForm.physicalAddress')}
            error={form.formState.errors.physicalAddress?.message}
          >
            <textarea
              id="club-address"
              className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              {...form.register('physicalAddress')}
            />
          </Field>
          <Field label={t('clubForm.mapLink')} error={form.formState.errors.mapLink?.message}>
            <Input id="club-map-link" type="url" {...form.register('mapLink')} />
          </Field>
          <Field
            label={t('clubForm.contactEmail')}
            error={form.formState.errors.contactEmail?.message}
          >
            <Input id="club-contact-email" type="email" {...form.register('contactEmail')} />
          </Field>
          <Field
            label={t('clubForm.contactPhone')}
            hint={t('clubForm.contactHint')}
            error={form.formState.errors.contactPhone?.message}
          >
            <Input id="club-contact-phone" type="tel" {...form.register('contactPhone')} />
          </Field>
          <Field
            label={t('common.timeZone')}
            hint={t('clubForm.timeZoneHint')}
            error={form.formState.errors.timeZone?.message}
          >
            <Input
              id="club-timezone"
              placeholder="America/Costa_Rica"
              {...form.register('timeZone')}
            />
          </Field>
          {!club && (
            <Field
              label={t('clubForm.initialOwner')}
              hint={t('clubForm.initialOwnerHint')}
              error={form.formState.errors.initialOwnerId?.message}
            >
              <Input id="club-initial-owner" {...form.register('initialOwnerId')} />
            </Field>
          )}
        </form>
        <DrawerFooter>
          <Button
            form="club-form"
            type="submit"
            disabled={pending || Boolean(club && isLoadingClub)}
          >
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

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
