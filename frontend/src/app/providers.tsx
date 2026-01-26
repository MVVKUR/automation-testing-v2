'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ProjectProvider } from '@/contexts/project-context';
import { ToastProvider, ErrorBoundary } from '@/components/ui';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ProjectProvider>
          <ToastProvider>{children}</ToastProvider>
        </ProjectProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
