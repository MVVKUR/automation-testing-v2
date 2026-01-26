'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Input } from '@/components/ui';

export default function DemoLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Listen for test commands via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AUTOTEST_ACTION') {
        console.log('Received test action:', event.data);

        const { action, selector, value } = event.data;

        if (action === 'type' && selector && value !== undefined) {
          // Find element by selector and set value
          const element = document.querySelector(selector) as HTMLInputElement;
          if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            // Update React state based on input name
            if (selector.includes('email') || element.type === 'email' || element.name === 'email') {
              setEmail(value);
            } else if (selector.includes('password') || element.type === 'password' || element.name === 'password') {
              setPassword(value);
            }
          }
        } else if (action === 'click' && selector) {
          const element = document.querySelector(selector) as HTMLElement;
          if (element) {
            element.click();
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate login
    setTimeout(() => {
      setIsLoading(false);
      if (email === 'admin@example.com' && password === 'password123') {
        setSuccess(true);
      } else {
        setError('Invalid email or password');
      }
    }, 1000);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h1>
          <p className="text-gray-600 mb-6">You have successfully logged in.</p>
          <p className="text-sm text-gray-500">Logged in as: {email}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Demo Login</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Demo credentials:</p>
          <p className="font-mono text-xs mt-1">admin@example.com / password123</p>
        </div>
      </Card>
    </div>
  );
}
