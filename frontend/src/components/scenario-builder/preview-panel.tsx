'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Input, Spinner } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrosshairs,
  faCamera,
  faVideo,
  faRotateLeft,
  faLock,
  faExpand,
  faDesktop,
  faTabletAlt,
  faMobileAlt,
  faPlay,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';

interface PreviewPanelProps {
  url: string;
  onUrlChange?: (url: string) => void;
  expanded?: boolean;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceSizes: Record<DeviceType, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: 'Desktop (1280x800)' },
  tablet: { width: 768, height: 1024, label: 'Tablet (768x1024)' },
  mobile: { width: 375, height: 667, label: 'Mobile (375x667)' },
};

export function PreviewPanel({ url: initialUrl, onUrlChange, expanded = false }: PreviewPanelProps) {
  const [url, setUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [scale, setScale] = useState(expanded ? 0.6 : 0.4);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update URL when prop changes
  useEffect(() => {
    if (initialUrl && initialUrl !== url) {
      setUrl(initialUrl);
      setInputUrl(initialUrl);
      setHasError(false);
    }
  }, [initialUrl]);

  // Update scale when expanded changes
  useEffect(() => {
    setScale(expanded ? 0.7 : 0.4);
  }, [expanded]);

  const handleNavigate = () => {
    let targetUrl = inputUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    setUrl(targetUrl);
    setIsLoading(true);
    setHasError(false);
    onUrlChange?.(targetUrl);
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = url;
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const { width, height, label } = deviceSizes[device];
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return (
    <aside className={`${expanded ? 'flex-1' : 'w-[450px]'} bg-surface border-l border-border-light flex flex-col transition-all duration-300`}>
      {/* Device Selector Header */}
      <div className="h-12 flex items-center justify-between px-4 bg-surface border-b border-border-light">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-2 rounded ${device === 'desktop' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-gray-100'}`}
            title="Desktop"
          >
            <FontAwesomeIcon icon={faDesktop} />
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-2 rounded ${device === 'tablet' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-gray-100'}`}
            title="Tablet"
          >
            <FontAwesomeIcon icon={faTabletAlt} />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-2 rounded ${device === 'mobile' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-gray-100'}`}
            title="Mobile"
          >
            <FontAwesomeIcon icon={faMobileAlt} />
          </button>
        </div>
        <span className="text-xs text-text-tertiary">{label}</span>
      </div>

      {/* URL Bar */}
      <div className="p-3 bg-panel border-b border-border-light">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-white border border-border rounded-lg overflow-hidden">
            <span className="px-2 text-text-tertiary">
              <FontAwesomeIcon icon={faLock} className="text-xs" />
            </span>
            <Input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              placeholder="Enter URL to preview"
              className="border-0 flex-1 text-sm h-8"
            />
          </div>
          <Button size="sm" onClick={handleNavigate}>
            <FontAwesomeIcon icon={faPlay} />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')}>
            <FontAwesomeIcon icon={faExternalLinkAlt} />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-[#1a1a2e] flex justify-center items-center p-4 relative overflow-hidden">
        <div
          className="bg-white rounded-lg shadow-2xl overflow-hidden relative"
          style={{
            width: scaledWidth,
            height: scaledHeight,
          }}
        >
          {/* Browser Chrome */}
          <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-3 gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white h-5 rounded px-2 flex items-center text-[10px] text-gray-500 truncate ml-2">
              {url}
            </div>
          </div>

          {/* Iframe Container */}
          <div
            className="relative bg-white"
            style={{
              width: scaledWidth,
              height: scaledHeight - 32, // Subtract browser chrome height
              overflow: 'hidden',
            }}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <Spinner />
              </div>
            )}

            {hasError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <p className="text-sm text-text-secondary mb-2">Unable to load preview</p>
                <p className="text-xs text-text-tertiary mb-4 max-w-xs">
                  This site may block iframe embedding. To preview your app, run it locally and enter the localhost URL.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => window.open(url, '_blank')}>
                    <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            ) : url ? (
              <iframe
                ref={iframeRef}
                src={url}
                title="Preview"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                style={{
                  width: width,
                  height: height - 32,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: 'none',
                }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <p className="text-sm text-text-secondary mb-2">No URL specified</p>
                <p className="text-xs text-text-tertiary">
                  Enter a URL above to preview the page
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tool Palette */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-lg">
          <Button variant="icon" className="w-9 h-9 rounded-lg" title="Inspect Element">
            <FontAwesomeIcon icon={faCrosshairs} />
          </Button>
          <Button variant="icon" className="w-9 h-9 rounded-lg" title="Take Screenshot">
            <FontAwesomeIcon icon={faCamera} />
          </Button>
          <Button variant="icon" className="w-9 h-9 rounded-lg" title="Record Video">
            <FontAwesomeIcon icon={faVideo} />
          </Button>
          <Button variant="icon" className="w-9 h-9 rounded-lg" title="Refresh" onClick={handleRefresh}>
            <FontAwesomeIcon icon={faRotateLeft} />
          </Button>
          <div className="border-t border-border my-1" />
          <Button variant="icon" className="w-9 h-9 rounded-lg" title="Fullscreen">
            <FontAwesomeIcon icon={faExpand} />
          </Button>
        </div>
      </div>

      {/* Scale Control */}
      <div className="h-10 flex items-center justify-center gap-4 px-4 bg-surface border-t border-border-light">
        <span className="text-xs text-text-tertiary">Zoom:</span>
        <input
          type="range"
          min="0.25"
          max="1"
          step="0.05"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="w-24"
        />
        <span className="text-xs text-text-secondary w-12">{Math.round(scale * 100)}%</span>
      </div>
    </aside>
  );
}
