'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '{}' },
  { href: '/stacks', label: 'Stacks', icon: '[]' },
  { href: '/updates', label: 'Updates', icon: '^' },
  { href: '/settings', label: 'Settings', icon: '*' },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col h-screen shrink-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">DevHub</h1>
        <p className="text-xs text-muted-foreground">Local Dev Manager</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <span className="font-mono text-xs w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </div>
    </aside>
  );
}
