'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/ui';

interface AppShellProps {
  children: React.ReactNode;
}

// Pages that should not show sidebar (full-screen pages)
const fullScreenPaths = ['/login', '/register', '/onboarding'];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isFullScreen = fullScreenPaths.some((path) => pathname.startsWith(path));

  if (isFullScreen) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
