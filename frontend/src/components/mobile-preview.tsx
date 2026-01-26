'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSync,
  faMobileAlt,
  faArrowLeft,
  faHome,
  faSquare,
  faCircle,
  faSpinner,
  faExclamationTriangle,
  faCheck,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

interface MobilePreviewProps {
  deviceId?: string;
  packageName?: string;
  platform?: 'android' | 'ios';
  onTap?: (x: number, y: number, success: boolean) => void;
  onTapError?: (error: string) => void;
  isRunning?: boolean;
  refreshInterval?: number; // ms between screenshot refreshes
  showControls?: boolean;
}

// Tap feedback indicator
interface TapIndicator {
  x: number;
  y: number;
  success: boolean;
  id: number;
}

interface ScreenInfo {
  width: number;
  height: number;
}

export default function MobilePreview({
  deviceId,
  packageName,
  platform = 'android',
  onTap,
  onTapError,
  isRunning = false,
  refreshInterval = 500,
  showControls = true,
}: MobilePreviewProps) {
  const isIOS = platform === 'ios';
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenSize, setScreenSize] = useState<ScreenInfo>({ width: 1080, height: 1920 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [tapIndicators, setTapIndicators] = useState<TapIndicator[]>([]);
  const [tapping, setTapping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tapIdCounter = useRef(0);

  // Capture screenshot from device
  const captureScreenshot = useCallback(async () => {
    try {
      let base64Image: string;
      if (isIOS) {
        base64Image = await invoke<string>('ios_take_screenshot', { deviceId });
        // iOS returns raw base64, need to add data URL prefix
        base64Image = `data:image/png;base64,${base64Image}`;
      } else {
        base64Image = await invoke<string>('adb_take_screenshot', { deviceId });
      }
      setScreenshot(base64Image);
      setConnected(true);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Screenshot capture error:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture screenshot');
      setConnected(false);
      setLoading(false);
    }
  }, [deviceId, isIOS]);

  // Get screen dimensions
  const getScreenSize = useCallback(async () => {
    try {
      let size: ScreenInfo;
      if (isIOS) {
        size = await invoke<ScreenInfo>('ios_get_screen_size', { deviceId });
      } else {
        size = await invoke<ScreenInfo>('adb_get_screen_size', { deviceId });
      }
      setScreenSize(size);
    } catch (err) {
      console.error('Failed to get screen size:', err);
    }
  }, [deviceId, isIOS]);

  // Start continuous screen refresh
  useEffect(() => {
    // Initial fetch
    getScreenSize();
    captureScreenshot();

    // Set up interval for continuous refresh
    intervalRef.current = setInterval(() => {
      captureScreenshot();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [captureScreenshot, getScreenSize, refreshInterval]);

  // Add a tap indicator with animation
  const addTapIndicator = useCallback((relX: number, relY: number, success: boolean) => {
    const id = tapIdCounter.current++;
    const indicator: TapIndicator = {
      x: relX * 100, // percentage
      y: relY * 100,
      success,
      id,
    };
    setTapIndicators(prev => [...prev, indicator]);
    // Remove indicator after animation
    setTimeout(() => {
      setTapIndicators(prev => prev.filter(i => i.id !== id));
    }, 1000);
  }, []);

  // Handle tap on the preview
  const handleTapOnPreview = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !connected || tapping) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;

    const deviceX = Math.round(relativeX * screenSize.width);
    const deviceY = Math.round(relativeY * screenSize.height);

    setTapping(true);

    try {
      if (isIOS) {
        await invoke('ios_tap', { x: deviceX, y: deviceY, deviceId });
      } else {
        await invoke('adb_tap', { deviceId, x: deviceX, y: deviceY });
      }
      // Show success indicator
      addTapIndicator(relativeX, relativeY, true);
      // Immediately capture screenshot to show result
      setTimeout(captureScreenshot, 100);
      onTap?.(deviceX, deviceY, true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Tap error:', errorMsg);
      // Show failure indicator
      addTapIndicator(relativeX, relativeY, false);
      onTap?.(deviceX, deviceY, false);
      onTapError?.(errorMsg);
    } finally {
      setTapping(false);
    }
  }, [deviceId, screenSize, connected, tapping, captureScreenshot, onTap, onTapError, addTapIndicator, isIOS]);

  // Navigation buttons
  const handleBack = async () => {
    try {
      if (isIOS) {
        // iOS: Swipe from left edge to go back
        await invoke('ios_swipe', {
          x1: 10,
          y1: Math.round(screenSize.height / 2),
          x2: Math.round(screenSize.width * 0.5),
          y2: Math.round(screenSize.height / 2),
          deviceId
        });
      } else {
        await invoke('adb_press_back', { deviceId });
      }
      setTimeout(captureScreenshot, 200);
    } catch (err) {
      console.error('Back button error:', err);
    }
  };

  const handleHome = async () => {
    try {
      if (isIOS) {
        await invoke('ios_press_home', { deviceId });
      } else {
        await invoke('adb_press_home', { deviceId });
      }
      setTimeout(captureScreenshot, 200);
    } catch (err) {
      console.error('Home button error:', err);
    }
  };

  const handleRecents = async () => {
    try {
      if (isIOS) {
        // iOS: Swipe up and pause to show app switcher
        await invoke('ios_swipe', {
          x1: Math.round(screenSize.width / 2),
          y1: screenSize.height - 50,
          x2: Math.round(screenSize.width / 2),
          y2: Math.round(screenSize.height / 2),
          durationMs: 500,
          deviceId
        });
      } else {
        await invoke('adb_keyevent', { deviceId, keycode: 'KEYCODE_APP_SWITCH' });
      }
      setTimeout(captureScreenshot, 200);
    } catch (err) {
      console.error('Recents button error:', err);
    }
  };

  const handleLaunchApp = async () => {
    if (!packageName) return;
    try {
      if (isIOS) {
        await invoke('ios_launch_app', { bundleId: packageName, deviceId });
      } else {
        await invoke('adb_launch_app', { deviceId, packageName });
      }
      setTimeout(captureScreenshot, 500);
    } catch (err) {
      console.error('Launch app error:', err);
    }
  };

  // Calculate aspect ratio for display
  const aspectRatio = screenSize.height / screenSize.width;

  return (
    <div className="flex flex-col items-center h-full">
      {/* Status bar */}
      <div className="w-full max-w-xs px-4 py-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <FontAwesomeIcon
            icon={faCircle}
            className={connected ? 'text-green-500' : 'text-red-500'}
            style={{ fontSize: '8px' }}
          />
          <span className="text-gray-600">
            {connected ? `${isIOS ? 'iOS' : 'Android'} Connected` : 'Disconnected'}
          </span>
        </div>
        <button
          onClick={captureScreenshot}
          disabled={loading}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <FontAwesomeIcon
            icon={loading ? faSpinner : faSync}
            className={`text-gray-500 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Phone frame */}
      <div
        className="relative bg-gray-900 rounded-[40px] p-2 shadow-2xl"
        style={{ maxWidth: '320px', width: '100%' }}
      >
        {/* Top notch / speaker */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-xl z-10" />

        {/* Screen container */}
        <div
          ref={containerRef}
          className="relative bg-black rounded-[32px] overflow-hidden cursor-pointer"
          style={{ aspectRatio: `${screenSize.width}/${screenSize.height}` }}
          onClick={handleTapOnPreview}
        >
          {loading && !screenshot ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <FontAwesomeIcon icon={faSpinner} className="text-3xl animate-spin mb-3" />
                <p className="text-sm">Connecting to device...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white px-4">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl text-yellow-500 mb-3" />
                <p className="text-sm mb-2">Connection Error</p>
                <p className="text-xs text-gray-400 mb-3">{error}</p>
                <button
                  onClick={captureScreenshot}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : screenshot ? (
            <img
              src={screenshot}
              alt="Device Screen"
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : null}

          {/* Tap indicators */}
          {tapIndicators.map((indicator) => (
            <div
              key={indicator.id}
              className="absolute pointer-events-none"
              style={{
                left: `${indicator.x}%`,
                top: `${indicator.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Ripple effect */}
              <div
                className={`w-12 h-12 rounded-full animate-ping ${
                  indicator.success ? 'bg-green-400/50' : 'bg-red-400/50'
                }`}
              />
              {/* Center icon */}
              <div
                className={`absolute inset-0 flex items-center justify-center`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    indicator.success ? 'bg-green-500' : 'bg-red-500'
                  } animate-bounce`}
                >
                  <FontAwesomeIcon
                    icon={indicator.success ? faCheck : faTimes}
                    className="text-white text-sm"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Tapping indicator */}
          {tapping && (
            <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
              <FontAwesomeIcon icon={faSpinner} className="text-white text-2xl animate-spin" />
            </div>
          )}

          {/* Running indicator overlay */}
          {isRunning && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-primary/80 text-white text-xs rounded-full flex items-center gap-1">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              Running
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        {showControls && (
          <div className="flex items-center justify-center gap-6 py-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title={isIOS ? "Back (Swipe Gesture)" : "Back"}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="text-lg" />
            </button>
            <button
              onClick={handleHome}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title="Home"
            >
              <FontAwesomeIcon icon={faCircle} className="text-xl" />
            </button>
            <button
              onClick={handleRecents}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title={isIOS ? "App Switcher (Swipe Up)" : "Recent Apps"}
            >
              <FontAwesomeIcon icon={faSquare} className="text-lg" />
            </button>
          </div>
        )}
      </div>

      {/* Launch app button */}
      {packageName && showControls && (
        <button
          onClick={handleLaunchApp}
          className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
        >
          <FontAwesomeIcon icon={faMobileAlt} className="mr-2" />
          Launch {packageName.split('.').pop()}
        </button>
      )}

      {/* Device info */}
      <div className="mt-4 text-center text-xs text-gray-500">
        <p>{screenSize.width} x {screenSize.height}</p>
        {deviceId && <p className="text-gray-400 mt-1">{deviceId}</p>}
      </div>
    </div>
  );
}
