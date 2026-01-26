'use client';

import { Card, Input, Button } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faRobot, faServer, faPalette } from '@fortawesome/free-solid-svg-icons';

export default function SettingsPage() {
  return (
    <div className="flex-1 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>

        {/* Test Runner Settings */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faServer} className="text-neutral-700" />
            </div>
            <div>
              <h3 className="font-semibold">Test Runner</h3>
              <p className="text-sm text-text-secondary">Configure test execution settings</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Test Runner URL
              </label>
              <Input
                type="text"
                defaultValue="http://localhost:8082"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Default Browser
              </label>
              <select className="w-full px-3 py-2 border border-border rounded-lg bg-white text-sm">
                <option value="chrome">Chrome</option>
                <option value="firefox">Firefox</option>
                <option value="safari">Safari</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="headless" className="rounded" defaultChecked={false} />
              <label htmlFor="headless" className="text-sm text-text-primary">
                Run tests in headless mode
              </label>
            </div>
          </div>
        </Card>

        {/* AI Settings */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faRobot} className="text-neutral-700" />
            </div>
            <div>
              <h3 className="font-semibold">AI Configuration</h3>
              <p className="text-sm text-text-secondary">Configure AI-powered features</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                AI Provider
              </label>
              <select className="w-full px-3 py-2 border border-border rounded-lg bg-white text-sm">
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI GPT-4</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="selfheal" className="rounded" defaultChecked={true} />
              <label htmlFor="selfheal" className="text-sm text-text-primary">
                Enable self-healing selectors
              </label>
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faPalette} className="text-neutral-700" />
            </div>
            <div>
              <h3 className="font-semibold">Appearance</h3>
              <p className="text-sm text-text-secondary">Customize the look and feel</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Theme
              </label>
              <select className="w-full px-3 py-2 border border-border rounded-lg bg-white text-sm">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}
