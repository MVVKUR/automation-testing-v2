'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-md w-full text-center">
        <div className="text-red-500 text-4xl mb-4">!</div>
        <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-zinc-400 mb-6 text-sm">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
