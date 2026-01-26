'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-black">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-md w-full text-center">
            <div className="text-red-500 text-4xl mb-4">!</div>
            <h2 className="text-xl font-semibold text-white mb-2">Application Error</h2>
            <p className="text-zinc-400 mb-6 text-sm">
              {error.message || 'A critical error occurred'}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
