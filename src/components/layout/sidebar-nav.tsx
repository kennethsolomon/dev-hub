'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Layers, Activity, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/stacks', label: 'Stacks', icon: Layers },
  { href: '/updates', label: 'Updates', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav({ mobile = false, onNavigate }: { mobile?: boolean, onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={cn(
      "flex flex-col h-full bg-background",
      !mobile && "w-60 border-r border-border shrink-0"
    )}>
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="DevHub" width={28} height={28} />
          <h1 className="text-xl font-bold tracking-tight font-display text-foreground">
            DevHub
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-9">v0.1.0</p>
      </div>

      <div className="mx-4 border-t border-border" />

      <nav className="flex-1 p-3 space-y-1 mt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative',
                isActive
                  ? 'bg-primary/8 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <Icon className={cn("w-[18px] h-[18px] transition-colors", isActive ? "text-primary" : "group-hover:text-foreground")} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Stable</p>
        <ThemeToggle />
      </div>
    </aside>
  );
}
