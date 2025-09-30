
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  History,
  Trash2,
  Disc3,
  Settings,
  Undo,
  Package,
  Bomb,
  FileLock,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/wipe', icon: Trash2, label: 'Wipe' },
  { href: '/restore', icon: Undo, label: 'Decrypt & Restore' },
  { href: '/history', icon: History, label: 'History' },
  { href: '/iso-mode', icon: Disc3, label: 'ISO Mode' },
  { href: '/bomber-game', icon: Bomb, label: 'Bomber Game' },
  { href: '/encrypt-files', icon: FileLock, label: 'Encrypt Files' },
];

const masterNavItems = [
    { href: '/master/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/master/wipe', icon: Trash2, label: 'Wipe' },
    { href: '/master/restore', icon: Undo, label: 'Decrypt & Restore' },
    { href: '/master/history', icon: History, label: 'History' },
    { href: '/master/iso-mode', icon: Disc3, label: 'ISO Mode' },
    { href: '/master/cart', icon: Package, label: 'Shop' },
]

export default function AppSidebar() {
  const pathname = usePathname();
  const isMaster = pathname.startsWith('/master');
  const base_path = isMaster ? '/master' : '/worker';
  const items = isMaster ? masterNavItems : navItems.map(item => ({...item, href: `/worker${item.href}`}));


  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <TooltipProvider>
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href={`${base_path}/dashboard`}
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <ShieldCheck className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">SecureWipe</span>
          </Link>

          {items.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                    (pathname === item.href || pathname.startsWith(`${item.href}/`)) && 'bg-accent text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </nav>
      </TooltipProvider>
    </aside>
  );
}
