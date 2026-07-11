'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  HelpCircle,
  ImageIcon,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Shield,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/src/locale-provider';
import { managementAuthClient } from '@/src/lib/auth-client';
import { cn } from '@/src/lib/utils';
import { useWorkspaceClub, useWorkspaceMe } from '@/src/hooks/workspace';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function initials(name?: string) {
  return (name ?? '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const { data: me } = useWorkspaceMe();
  const routeClubId = pathname.match(/^\/workspace\/clubs\/([^/]+)/)?.[1] ?? '';
  const { data: routeClub } = useWorkspaceClub(routeClubId);
  const selected = useMemo(() => {
    const membership = me?.memberships.find((item) => item.clubId === routeClubId);
    if (membership) return membership;
    if (!me?.platformAdmin || !routeClub) return undefined;
    return {
      clubId: routeClub.id,
      clubName: routeClub.name,
      clubSlug: routeClub.slug,
      clubTimeZone: routeClub.timeZone,
      membershipStatus: null,
      responsibilities: [],
      permissions: routeClub.archivedAt ? ['club.view', 'club.restore'] : ['club.view'],
    };
  }, [me?.memberships, me?.platformAdmin, routeClub, routeClubId]);
  const canManageMembers = selected?.permissions.includes('members.manage') ?? false;
  const canManageSessions = selected?.permissions.includes('session.create') ?? false;
  const canOperateClub =
    selected?.permissions.some((permission) =>
      ['members.manage', 'session.create', 'tournament.manage', 'results.correct'].includes(
        permission,
      ),
    ) ?? false;
  const clubBase = selected ? `/workspace/clubs/${selected.clubId}` : '';
  const items = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      { href: '/workspace', label: t('sidebar.dashboard'), icon: LayoutDashboard },
      { href: '/workspace/clubs', label: t('sidebar.clubs'), icon: Shield },
    ];
    if (!selected || !canOperateClub) return base;
    return [
      ...base,
      ...(canManageMembers
        ? [{ href: `${clubBase}/members`, label: t('sidebar.members'), icon: Users }]
        : []),
      ...(canManageSessions
        ? [{ href: `${clubBase}/sessions`, label: t('sidebar.sessions'), icon: CalendarDays }]
        : []),
      { href: `${clubBase}/tournaments`, label: t('sidebar.tournaments'), icon: Trophy },
      { href: `${clubBase}/matches`, label: t('sidebar.matches'), icon: ClipboardCheck },
      { href: `${clubBase}/statistics`, label: t('sidebar.statistics'), icon: BarChart3 },
    ];
  }, [canManageMembers, canManageSessions, canOperateClub, clubBase, selected, t]);

  const title =
    items.find((item) => pathname === item.href)?.label ??
    selected?.clubName ??
    t('workspace.heading');

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 items-center border-b px-3">
        <Link href="/workspace" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            S
          </span>
          {t('app.name')}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X />
        </Button>
      </div>
      <div className="border-b p-3">
        <Select
          value={selected?.clubId ?? ''}
          onValueChange={(clubId) => router.push(`/workspace/clubs/${clubId}`)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('workspace.selectClub')} />
          </SelectTrigger>
          <SelectContent>
            {me?.memberships.map((membership) => (
              <SelectItem key={membership.clubId} value={membership.clubId}>
                {membership.clubName}
              </SelectItem>
            ))}
            {me?.platformAdmin &&
              routeClub &&
              !me.memberships.some((item) => item.clubId === routeClub.id) && (
                <SelectItem value={routeClub.id}>{routeClub.name}</SelectItem>
              )}
          </SelectContent>
        </Select>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/workspace' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                active &&
                  'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        {me?.platformAdmin && (
          <div className="pt-4">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('sidebar.platform')}
            </p>
            {[
              { href: '/workspace/platform/users', label: t('sidebar.users'), icon: Users },
              {
                href: '/workspace/platform/audit',
                label: t('sidebar.audit'),
                icon: ClipboardCheck,
              },
              { href: '/workspace/platform/media', label: t('sidebar.media'), icon: ImageIcon },
              { href: '/workspace/platform/jobs', label: t('sidebar.jobs'), icon: Package },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent',
                  pathname === item.href && 'bg-primary text-primary-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <div className="border-t p-2">
        <a
          href="mailto:support@example.com"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
        >
          <HelpCircle className="size-4" />
          {t('sidebar.help')}
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="mt-1 h-auto w-full justify-start px-2 py-2">
              <Avatar>
                <AvatarImage src={me?.user.image ?? ''} />
                <AvatarFallback>{initials(me?.user.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm">{me?.user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {me?.user.email}
                </span>
              </span>
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel>{me?.user.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/workspace/account">
                <CircleUserRound />
                {t('userMenu.profile')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/workspace/account/notifications">
                <Bell />
                {t('userMenu.notifications')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/security">
                <ShieldCheck />
                {t('userMenu.security')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocale(locale === 'en-US' ? 'es-419' : 'en-US')}>
              <Languages />
              {t('userMenu.language')}: {locale === 'en-US' ? 'Español' : 'English'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await managementAuthClient.signOut();
                router.push('/login');
                router.refresh();
              }}
            >
              <LogOut />
              {t('userMenu.logOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[18rem_1fr]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r md:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-72 border-r">{sidebar}</aside>
        </div>
      )}
      <div className="md:col-start-2">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <div className="h-4 w-px bg-border md:hidden" />
          <h1 className="text-sm font-medium">{title}</h1>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
