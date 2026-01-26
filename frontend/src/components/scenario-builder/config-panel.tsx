'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Input,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Chip,
} from '@/components/ui';

interface ConfigPanelProps {
  stepTitle: string;
  stepDescription: string;
  defaultUrl?: string;
  onUrlChange?: (url: string) => void;
}

export function ConfigPanel({ stepTitle, stepDescription, defaultUrl = 'https://example.com', onUrlChange }: ConfigPanelProps) {
  const [url, setUrl] = useState(defaultUrl);

  // Update URL when defaultUrl prop changes
  useEffect(() => {
    setUrl(defaultUrl);
  }, [defaultUrl]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    onUrlChange?.(newUrl);
  };

  return (
    <main className="flex-1 bg-panel overflow-y-auto flex flex-col">
      <div className="p-6 pb-4">
        <h2 className="text-xl font-semibold mb-1">{stepTitle}</h2>
        <span className="text-text-secondary">{stepDescription}</span>
      </div>

      <div className="px-6 pb-6 flex-1 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Action Settings</h3>
            <a href="#" className="text-primary text-sm hover:underline">
              Change Action
            </a>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="URL"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://..."
            />
            <Input label="Timeout (ms)" type="number" defaultValue="10000" />
          </CardBody>
        </Card>

        <Card>
          <Tabs defaultValue="verification">
            <TabsList>
              <TabsTrigger value="verification">Verification</TabsTrigger>
              <TabsTrigger value="post-action">Post Action Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="verification">
              <div className="flex justify-between items-center mb-4">
                <span className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input type="radio" name="logic" defaultChecked />
                    And
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="logic" />
                    Or
                  </label>
                </span>
                <div className="flex gap-3">
                  <a href="#" className="text-primary text-sm hover:underline">
                    Add Rule
                  </a>
                  <a href="#" className="text-primary text-sm hover:underline">
                    Add Group
                  </a>
                </div>
              </div>

              <div className="bg-app p-3 rounded border border-dashed border-border-medium">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Verify Page Title
                </label>
                <div className="flex gap-2">
                  <Select className="w-32">
                    <option>Equals</option>
                    <option>Contains</option>
                  </Select>
                  <Input placeholder="Value" className="flex-1" />
                  <Button variant="danger" size="sm">
                    Remove
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button size="sm">Update</Button>
                <Button variant="text" size="sm">
                  Reset
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="post-action">
              <p className="text-text-secondary text-sm">
                Configure actions to perform after the main action completes.
              </p>
            </TabsContent>
          </Tabs>
        </Card>

        <div className="mt-auto">
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase text-text-tertiary block mb-2">
              + Actions
            </span>
            <div className="flex gap-2 flex-wrap">
              <Chip>Click</Chip>
              <Chip>Type</Chip>
              <Chip>Wait</Chip>
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-text-tertiary block mb-2">
              + Verifications
            </span>
            <div className="flex gap-2 flex-wrap">
              <Chip>Visible</Chip>
              <Chip>Text</Chip>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
