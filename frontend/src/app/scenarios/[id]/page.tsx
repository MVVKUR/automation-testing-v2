'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button, Card, Input } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faChevronLeft,
  faChevronRight,
  faPlay,
  faPlus,
  faTrash,
  faGripVertical,
  faCheck,
  faSpinner,
  faTimes,
  faDesktop,
  faTabletAlt,
  faMobileAlt,
  faSearchPlus,
  faSearchMinus,
  faExpand,
  faHandPointer,
  faArrowsAltH,
  faKeyboard,
  faRobot,
  faLightbulb,
} from '@fortawesome/free-solid-svg-icons';
import { useProject } from '@/contexts/project-context';
import MobilePreview from '@/components/mobile-preview';
import { invoke } from '@tauri-apps/api/core';
import { aiWebApi, AiWebSuggestedStep, AiWebAnalysisResult, AiWebElementLocation } from '@/lib/tauri';

// Storage key for test runs (same as runs page)
const RUNS_STORAGE_KEY = 'test-runs-history';

// Device types for preview
type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceSizes: Record<DeviceType, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: 'Desktop' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
  mobile: { width: 375, height: 667, label: 'Mobile' },
};

// Zoom levels
const zoomLevels = [50, 75, 100, 125, 150];

// Step types (web + mobile)
type StepType = 'navigate' | 'type' | 'click' | 'verify' | 'wait' | 'tap' | 'swipe' | 'input' | 'back' | 'home' | 'launch';

interface TestStep {
  id: string;
  type: StepType;
  label: string;
  config: {
    url?: string;
    selector?: string;
    value?: string;
    timeout?: number;
    expected?: string;
    // Mobile-specific
    x?: number;
    y?: number;
    x2?: number;
    y2?: number;
    duration?: number;
    packageName?: string;
    keycode?: string;
  };
  status: 'pending' | 'running' | 'passed' | 'failed';
}

// AI Suggestion types
interface AiSuggestedStep {
  step_type: string;
  label: string;
  config: {
    x?: number;
    y?: number;
    x2?: number;
    y2?: number;
    value?: string;
    duration?: number;
    timeout?: number;
    element_description?: string;
  };
  confidence: number;
}

interface AiAnalysisResult {
  screen_description: string;
  detected_elements: Array<{
    element_type: string;
    description: string;
    bounds?: { x: number; y: number; width: number; height: number };
    text_content?: string;
  }>;
  suggested_steps: AiSuggestedStep[];
  test_context: string;
}

interface AiElementLocation {
  found: boolean;
  x: number;
  y: number;
  element_type: string;
  confidence: number;
  description: string;
}

// Mock test case data based on ID
const getTestCaseInfo = (id: string, baseUrl: string = '') => {
  const effectiveBaseUrl = baseUrl || '/demo';
  const testCases: Record<string, { name: string; scenario: string; defaultUrl: string }> = {
    'TC-001': {
      name: 'User Login with Valid Credentials',
      scenario: 'S1 - Login Flow',
      defaultUrl: `${effectiveBaseUrl}/login`,
    },
    'TC-002': {
      name: 'User Login with Invalid Credentials',
      scenario: 'S1 - Login Flow',
      defaultUrl: `${effectiveBaseUrl}/login`,
    },
  };
  return testCases[id] || {
    name: 'Test Case',
    scenario: 'Scenario',
    defaultUrl: `${effectiveBaseUrl}/login`,
  };
};

// Test run interface for storage (matches runs page)
interface TestRun {
  id: string;
  name: string;
  scenarioId: string;
  status: 'passed' | 'failed' | 'running' | 'pending' | 'queued' | 'cancelled' | 'timeout';
  duration: string;
  timestamp: string;
  passed: number;
  failed: number;
  total: number;
  startedAt?: string;
  projectId?: string;
  scenario?: {
    id: string;
    name: string;
    steps: unknown[];
  };
}

// Helper to save test run to localStorage
const saveTestRun = (run: TestRun) => {
  try {
    const stored = localStorage.getItem(RUNS_STORAGE_KEY);
    const runs: TestRun[] = stored ? JSON.parse(stored) : [];
    // Add new run at the beginning
    runs.unshift(run);
    // Keep only last 50 runs
    const trimmedRuns = runs.slice(0, 50);
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(trimmedRuns));
  } catch (e) {
    console.error('Failed to save test run:', e);
  }
};

// Helper to format duration
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// Generate initial steps for login test (web)
const getInitialSteps = (baseUrl: string): TestStep[] => {
  const effectiveBaseUrl = baseUrl || '/demo';
  return [
    { id: 'step-1', type: 'navigate', label: 'Navigate to Login Page', config: { url: `${effectiveBaseUrl}/login`, timeout: 10000 }, status: 'pending' },
    { id: 'step-2', type: 'type', label: 'Enter Email', config: { selector: '#email', value: 'admin@retailcredit.com' }, status: 'pending' },
    { id: 'step-3', type: 'type', label: 'Enter Password', config: { selector: '#password', value: 'admin123' }, status: 'pending' },
    { id: 'step-4', type: 'click', label: 'Click Sign In Button', config: { selector: 'form button[type="submit"]' }, status: 'pending' },
    { id: 'step-5', type: 'wait', label: 'Wait for Login', config: { timeout: 2000 }, status: 'pending' },
    { id: 'step-6', type: 'verify', label: 'Verify Login Success', config: { selector: '', expected: '/login' }, status: 'pending' },
  ];
};

// Generate initial steps for mobile app testing
const getMobileInitialSteps = (packageName: string): TestStep[] => {
  return [
    { id: 'step-1', type: 'launch', label: 'Launch App', config: { packageName, timeout: 5000 }, status: 'pending' },
    { id: 'step-2', type: 'wait', label: 'Wait for App to Load', config: { timeout: 3000 }, status: 'pending' },
    { id: 'step-3', type: 'tap', label: 'Tap Username Field', config: { x: 540, y: 800 }, status: 'pending' },
    { id: 'step-4', type: 'input', label: 'Enter Username', config: { value: 'demo_user' }, status: 'pending' },
    { id: 'step-5', type: 'tap', label: 'Tap Password Field', config: { x: 540, y: 950 }, status: 'pending' },
    { id: 'step-6', type: 'input', label: 'Enter Password', config: { value: 'demo123' }, status: 'pending' },
    { id: 'step-7', type: 'tap', label: 'Tap Login Button', config: { x: 540, y: 1150 }, status: 'pending' },
    { id: 'step-8', type: 'wait', label: 'Wait for Login', config: { timeout: 3000 }, status: 'pending' },
  ];
};

export default function ScenarioBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { currentProject } = useProject();

  const scenarioId = params.id as string;

  // Use project context or fall back to URL params for backwards compatibility
  // Memoize to avoid unnecessary re-renders
  const appBaseUrl = useMemo(() => {
    return currentProject?.appUrl || searchParams.get('appUrl') || '';
  }, [currentProject?.appUrl, searchParams]);

  // Detect mobile mode and platform from project source or search params
  const isMobileMode = useMemo(() => {
    const mode = searchParams.get('mode');
    const source = currentProject?.source;
    return mode === 'android' || mode === 'ios' || source === 'android' || source === 'ios';
  }, [searchParams, currentProject?.source]);

  // Determine platform (android or ios)
  const platform = useMemo(() => {
    const mode = searchParams.get('mode');
    const source = currentProject?.source;
    if (mode === 'ios' || source === 'ios') return 'ios';
    return 'android'; // default
  }, [searchParams, currentProject?.source]);

  const packageName = useMemo(() => {
    return currentProject?.packageName || searchParams.get('packageName') || 'app';
  }, [currentProject?.packageName, searchParams]);

  const deviceId = useMemo(() => {
    return currentProject?.deviceId || searchParams.get('deviceId') || undefined;
  }, [currentProject?.deviceId, searchParams]);

  const [steps, setSteps] = useState<TestStep[]>([]);
  const [activeStepId, setActiveStepId] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [zoom, setZoom] = useState(75);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [bridgeReady, setBridgeReady] = useState(false);
  const bridgeReadyRef = useRef(false);
  const hasInitialized = useRef(false);

  // AI Suggestion state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestedStep[]>([]);
  const [aiScreenDescription, setAiScreenDescription] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // AI Coordinate finder state
  const [findingCoordinates, setFindingCoordinates] = useState(false);

  // Web AI state (for web mode)
  const [webAiLoading, setWebAiLoading] = useState(false);
  const [webAiSuggestions, setWebAiSuggestions] = useState<AiWebSuggestedStep[]>([]);
  const [webAiPageDescription, setWebAiPageDescription] = useState('');
  const [webAiError, setWebAiError] = useState<string | null>(null);
  const [showWebAiModal, setShowWebAiModal] = useState(false);
  const [findingSelector, setFindingSelector] = useState(false);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // AI Find Coordinates for tap step
  const handleAiFindCoordinates = async (stepId: string, elementLabel: string) => {
    if (!isMobileMode) return;

    setFindingCoordinates(true);
    addLog(`🤖 AI finding coordinates for: "${elementLabel}"...`);

    try {
      // Take screenshot based on platform
      const screenshotCmd = platform === 'ios' ? 'ios_take_screenshot' : 'adb_take_screenshot';
      const screenshot = await invoke<string>(screenshotCmd, { deviceId });

      // Ask AI to find the element
      const result = await invoke<AiElementLocation>('ai_find_element_coordinates', {
        screenshotBase64: screenshot,
        elementDescription: elementLabel,
      });

      if (result.found && result.confidence > 0.5) {
        // Update step coordinates
        updateStepConfig(stepId, 'x', result.x);
        updateStepConfig(stepId, 'y', result.y);
        addLog(`✅ AI found element at (${result.x}, ${result.y}) - ${result.description}`);
        showToast(`Coordinates updated: (${result.x}, ${result.y})`, 'success');
      } else {
        addLog(`⚠️ AI couldn't find element: ${result.description}`);
        showToast(`Could not find "${elementLabel}" on screen`, 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`❌ AI coordinate finder failed: ${errorMsg}`);
      showToast(`AI Error: ${errorMsg}`, 'error');
    } finally {
      setFindingCoordinates(false);
    }
  };

  // Web AI Suggest handler for web mode
  const handleWebAiSuggest = async () => {
    if (isMobileMode) {
      addLog('Use AI Suggest button for mobile mode');
      return;
    }

    setShowWebAiModal(true);
    setWebAiLoading(true);
    setWebAiError(null);
    setWebAiSuggestions([]);
    setWebAiPageDescription('');

    try {
      addLog('Capturing web page for AI analysis...');

      // Capture screenshot from iframe
      const iframe = iframeRef.current;
      if (!iframe) {
        throw new Error('Preview iframe not available');
      }

      // Use html2canvas to capture the iframe content
      // For now, we'll use the iframe's document HTML if accessible
      let pageHtml: string | undefined;
      try {
        pageHtml = iframe.contentDocument?.documentElement?.outerHTML;
      } catch {
        // Cross-origin restriction - HTML not accessible
        addLog('Note: Page HTML not accessible due to cross-origin restrictions');
      }

      // Create a canvas to capture the iframe as screenshot
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size to match iframe
      canvas.width = deviceSizes[device].width;
      canvas.height = deviceSizes[device].height;

      // Draw iframe content to canvas (this works for same-origin or proxied content)
      if (ctx) {
        try {
          // Use drawWindow if available (Firefox), otherwise create image from iframe
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc) {
            // Create a simple screenshot representation
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333333';
            ctx.font = '16px Arial';
            ctx.fillText('Web Page Screenshot', 20, 30);
            ctx.fillText(`URL: ${previewUrl}`, 20, 60);
          }
        } catch {
          // Cross-origin - use placeholder
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      const screenshotBase64 = canvas.toDataURL('image/png').split(',')[1];

      addLog('Analyzing page with AI...');

      // Send to AI for analysis
      const result = await aiWebApi.analyzeWebPage(
        screenshotBase64,
        pageHtml,
        previewUrl,
        steps.map(s => ({ type: s.type, label: s.label, config: s.config })),
        `Testing web application. Analyze the current page and suggest appropriate test steps.`
      );

      setWebAiPageDescription(result.page_description);
      setWebAiSuggestions(result.suggested_steps);
      addLog(`AI found ${result.suggested_steps.length} suggested steps`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setWebAiError(errorMessage);
      addLog(`AI analysis failed: ${errorMessage}`);
    } finally {
      setWebAiLoading(false);
    }
  };

  // AI Find Selector for web click/type steps
  const handleAiFindSelector = async (stepId: string, elementLabel: string) => {
    if (isMobileMode) return;

    setFindingSelector(true);
    addLog(`AI finding selector for: "${elementLabel}"...`);

    try {
      // Capture screenshot from iframe
      const iframe = iframeRef.current;
      if (!iframe) {
        throw new Error('Preview iframe not available');
      }

      let pageHtml: string | undefined;
      try {
        pageHtml = iframe.contentDocument?.documentElement?.outerHTML;
      } catch {
        // Cross-origin restriction
      }

      // Create screenshot (simplified)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = deviceSizes[device].width;
      canvas.height = deviceSizes[device].height;

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const screenshotBase64 = canvas.toDataURL('image/png').split(',')[1];

      // Ask AI to find the element
      const result = await aiWebApi.findWebElement(
        screenshotBase64,
        elementLabel,
        pageHtml
      );

      if (result.found && result.confidence > 0.5) {
        // Update step selector
        updateStepConfig(stepId, 'selector', result.selector);
        addLog(`AI found element: ${result.selector} - ${result.description}`);
        showToast(`Selector updated: ${result.selector}`, 'success');
      } else {
        addLog(`AI couldn't find element: ${result.description}`);
        showToast(`Could not find "${elementLabel}" on page`, 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`AI selector finder failed: ${errorMsg}`);
      showToast(`AI Error: ${errorMsg}`, 'error');
    } finally {
      setFindingSelector(false);
    }
  };

  // Add Web AI suggested step to test
  const addWebAiSuggestedStep = (suggestion: AiWebSuggestedStep) => {
    const stepType = suggestion.step_type as StepType;
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      type: stepType,
      label: suggestion.label,
      config: {
        selector: suggestion.config.selector,
        url: suggestion.config.url,
        value: suggestion.config.value,
        timeout: suggestion.config.timeout,
      },
      status: 'pending',
    };
    setSteps(prev => [...prev, newStep]);
    setActiveStepId(newStep.id);
    addLog(`Added AI suggested step: ${suggestion.label}`);
  };

  // Add all Web AI suggestions at once
  const addAllWebAiSuggestions = () => {
    webAiSuggestions.forEach((suggestion, index) => {
      setTimeout(() => {
        addWebAiSuggestedStep(suggestion);
      }, index * 100);
    });
    setShowWebAiModal(false);
    addLog(`Added ${webAiSuggestions.length} AI suggested steps`);
  };

  // Preview iframe is for visual feedback during test building
  // Run Test always uses Cypress for real verification

  // Memoize test case info to prevent recalculation on every render
  const testCaseInfo = useMemo(() => {
    return getTestCaseInfo(scenarioId, appBaseUrl);
  }, [scenarioId, appBaseUrl]);

  const isUsingDemoPage = !appBaseUrl;
  const { width: deviceWidth, height: deviceHeight, label: deviceLabel } = deviceSizes[device];

  const getProxyUrl = (targetUrl: string) => {
    if (!targetUrl || targetUrl.startsWith('/demo')) return targetUrl;
    return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setExecutionLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Initialize steps only once when the component mounts or when project changes
  useEffect(() => {
    if (!hasInitialized.current || appBaseUrl !== '') {
      if (isMobileMode) {
        setSteps(getMobileInitialSteps(packageName));
      } else {
        setSteps(getInitialSteps(appBaseUrl));
        setPreviewUrl(getProxyUrl(testCaseInfo.defaultUrl));
      }
      setActiveStepId('step-1');
      hasInitialized.current = true;
    }
  }, [appBaseUrl, testCaseInfo.defaultUrl, isMobileMode, packageName]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AUTOTEST_BRIDGE_READY') {
        setBridgeReady(true);
        bridgeReadyRef.current = true;
        addLog('🔗 Bridge connected');
      } else if (event.data?.type === 'AUTOTEST_RESULT') {
        if (event.data.success && event.data.finalValue) {
          addLog(`✅ Typed: "${event.data.finalValue}"`);
        } else if (!event.data.success) {
          addLog(`❌ Failed: ${event.data.error}`);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const activeStep = steps.find(s => s.id === activeStepId);

  const updateStepConfig = (stepId: string, field: string, value: string | number) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, config: { ...step.config, [field]: value } } : step
    ));
  };

  const updateStepLabel = (stepId: string, label: string) => {
    setSteps(prev => prev.map(step => step.id === stepId ? { ...step, label } : step));
  };

  const addStep = (type: StepType) => {
    const labels: Record<StepType, string> = {
      navigate: 'Navigate to URL',
      type: 'Enter Value',
      click: 'Click Element',
      wait: 'Wait',
      verify: 'Verify',
      tap: 'Tap Element',
      swipe: 'Swipe Gesture',
      input: 'Input Text',
      back: 'Press Back',
      home: 'Press Home',
      launch: 'Launch App',
    };
    const configs: Record<StepType, TestStep['config']> = {
      navigate: { url: '' },
      type: { selector: '', value: '' },
      click: { selector: '' },
      wait: { timeout: 1000 },
      verify: { selector: '', expected: '' },
      tap: { x: 540, y: 960 },
      swipe: { x: 540, y: 1200, x2: 540, y2: 600, duration: 300 },
      input: { value: '' },
      back: {},
      home: {},
      launch: { packageName: packageName },
    };
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      type,
      label: labels[type] || 'New Step',
      config: configs[type] || {},
      status: 'pending',
    };
    setSteps(prev => [...prev, newStep]);
    setActiveStepId(newStep.id);
  };

  // AI Suggestion handler
  const handleAiSuggest = async () => {
    if (!isMobileMode) {
      addLog('⚠️ AI suggestions currently only support mobile mode');
      return;
    }

    setShowAiModal(true);
    setAiLoading(true);
    setAiError(null);
    setAiSuggestions([]);
    setAiScreenDescription('');

    try {
      addLog('🤖 Capturing screen for AI analysis...');

      // Take a screenshot first (platform-specific)
      const screenshotCmd = platform === 'ios' ? 'ios_take_screenshot' : 'adb_take_screenshot';
      const screenshot = await invoke<string>(screenshotCmd, { deviceId });

      addLog('🧠 Analyzing screen with AI...');

      // Send to AI for analysis
      const result = await invoke<AiAnalysisResult>('ai_analyze_screen', {
        screenshotBase64: screenshot,
        currentSteps: steps.map(s => ({ type: s.type, label: s.label, config: s.config })),
        testContext: `Testing mobile app. Analyze the current screen and suggest appropriate test steps based on what you see.`,
      });

      setAiScreenDescription(result.screen_description);
      setAiSuggestions(result.suggested_steps);
      addLog(`✅ AI found ${result.suggested_steps.length} suggested steps`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setAiError(errorMessage);
      addLog(`❌ AI analysis failed: ${errorMessage}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Add AI suggested step to test
  const addAiSuggestedStep = (suggestion: AiSuggestedStep) => {
    const stepType = suggestion.step_type as StepType;
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      type: stepType,
      label: suggestion.label,
      config: {
        x: suggestion.config.x,
        y: suggestion.config.y,
        x2: suggestion.config.x2,
        y2: suggestion.config.y2,
        value: suggestion.config.value,
        duration: suggestion.config.duration,
        timeout: suggestion.config.timeout,
      },
      status: 'pending',
    };
    setSteps(prev => [...prev, newStep]);
    setActiveStepId(newStep.id);
    addLog(`➕ Added AI suggested step: ${suggestion.label}`);
  };

  // Add all AI suggestions at once
  const addAllAiSuggestions = () => {
    aiSuggestions.forEach((suggestion, index) => {
      setTimeout(() => {
        addAiSuggestedStep(suggestion);
      }, index * 100); // Small delay between each to avoid race conditions
    });
    setShowAiModal(false);
    addLog(`➕ Added ${aiSuggestions.length} AI suggested steps`);
  };

  const deleteStep = (stepId: string) => {
    setSteps(prev => prev.filter(s => s.id !== stepId));
    if (activeStepId === stepId && steps.length > 1) {
      setActiveStepId(steps[0].id);
    }
  };

  const executeStepLive = useCallback(async (step: TestStep): Promise<boolean> => {
    const iframe = iframeRef.current;
    const defaultTimeout = step.config.timeout || 5000;

    return new Promise((resolve) => {
      try {
        switch (step.type) {
          case 'navigate':
            if (step.config.url) {
              addLog(`🌐 Navigating to ${step.config.url}...`);
              setBridgeReady(false);
              bridgeReadyRef.current = false;
              setPreviewUrl(getProxyUrl(step.config.url));
              const checkReady = setInterval(() => {
                if (bridgeReadyRef.current) {
                  clearInterval(checkReady);
                  addLog(`✅ Page loaded`);
                  resolve(true);
                }
              }, 100);
              setTimeout(() => {
                clearInterval(checkReady);
                if (!bridgeReadyRef.current) {
                  addLog(`⚠️ Navigation timeout, continuing...`);
                }
                resolve(true);
              }, step.config.timeout || 10000);
            } else {
              resolve(true);
            }
            break;

          case 'type':
            if (step.config.selector && step.config.value && iframe?.contentWindow) {
              addLog(`⌨️ Typing into ${step.config.selector}...`);
              iframe.contentWindow.postMessage({
                type: 'AUTOTEST_ACTION',
                action: 'type',
                selector: step.config.selector,
                value: step.config.value,
                timeout: defaultTimeout,
              }, '*');
              // Wait for typing to complete (30ms per char + buffer)
              setTimeout(() => resolve(true), (step.config.value.length * 30) + 1000);
            } else {
              addLog(`⚠️ Missing selector or value for type step`);
              resolve(true);
            }
            break;

          case 'click':
            if (step.config.selector && iframe?.contentWindow) {
              addLog(`🖱️ Clicking ${step.config.selector}...`);
              iframe.contentWindow.postMessage({
                type: 'AUTOTEST_ACTION',
                action: 'click',
                selector: step.config.selector,
                timeout: defaultTimeout,
              }, '*');
              // Wait for click animation and any navigation
              setTimeout(() => resolve(true), 1500);
            } else {
              addLog(`⚠️ Missing selector for click step`);
              resolve(true);
            }
            break;

          case 'wait':
            const waitTime = step.config.timeout || 1000;
            addLog(`⏳ Waiting ${waitTime}ms...`);
            setTimeout(() => {
              addLog(`✅ Wait completed`);
              resolve(true);
            }, waitTime);
            break;

          case 'verify':
            addLog(`🔍 Verifying...`);
            if (step.config.selector && iframe?.contentWindow) {
              // Verify element exists and is visible
              iframe.contentWindow.postMessage({
                type: 'AUTOTEST_ACTION',
                action: 'verify',
                selector: step.config.selector,
                timeout: defaultTimeout,
              }, '*');
              setTimeout(() => {
                addLog(`✅ Verification step completed`);
                resolve(true);
              }, 1000);
            } else if (step.config.expected) {
              // URL-based verification is handled by Cypress in the actual test
              addLog(`📋 URL verification configured: should not contain "${step.config.expected}"`);
              setTimeout(() => resolve(true), 500);
            } else {
              setTimeout(() => resolve(true), 500);
            }
            break;

          // Mobile step types (platform-specific commands)
          case 'tap':
            if (step.config.x !== undefined && step.config.y !== undefined) {
              addLog(`👆 Tapping at (${step.config.x}, ${step.config.y})...`);
              const tapCmd = platform === 'ios' ? 'ios_tap' : 'adb_tap';
              invoke(tapCmd, { deviceId, x: step.config.x, y: step.config.y })
                .then(() => {
                  addLog(`✅ Tap completed`);
                  setTimeout(() => resolve(true), 500);
                })
                .catch((err) => {
                  addLog(`❌ Tap failed: ${err}`);
                  resolve(false);
                });
            } else {
              addLog(`⚠️ Missing coordinates for tap step`);
              resolve(true);
            }
            break;

          case 'swipe':
            if (step.config.x !== undefined && step.config.y !== undefined &&
                step.config.x2 !== undefined && step.config.y2 !== undefined) {
              addLog(`↔️ Swiping from (${step.config.x}, ${step.config.y}) to (${step.config.x2}, ${step.config.y2})...`);
              const swipeCmd = platform === 'ios' ? 'ios_swipe' : 'adb_swipe';
              invoke(swipeCmd, {
                deviceId,
                x1: step.config.x,
                y1: step.config.y,
                x2: step.config.x2,
                y2: step.config.y2,
                durationMs: step.config.duration || 300,
              })
                .then(() => {
                  addLog(`✅ Swipe completed`);
                  setTimeout(() => resolve(true), 500);
                })
                .catch((err) => {
                  addLog(`❌ Swipe failed: ${err}`);
                  resolve(false);
                });
            } else {
              addLog(`⚠️ Missing coordinates for swipe step`);
              resolve(true);
            }
            break;

          case 'input':
            if (step.config.value) {
              addLog(`⌨️ Inputting text: "${step.config.value}"...`);
              const inputCmd = platform === 'ios' ? 'ios_input_text' : 'adb_input_text';
              invoke(inputCmd, { deviceId, text: step.config.value })
                .then(() => {
                  addLog(`✅ Input completed`);
                  setTimeout(() => resolve(true), 500);
                })
                .catch((err) => {
                  addLog(`❌ Input failed: ${err}`);
                  resolve(false);
                });
            } else {
              addLog(`⚠️ Missing value for input step`);
              resolve(true);
            }
            break;

          case 'back':
            addLog(`⬅️ Pressing back button...`);
            // iOS doesn't have a back button - use swipe or skip
            if (platform === 'ios') {
              addLog(`⚠️ iOS: Back gesture via swipe is recommended`);
              setTimeout(() => resolve(true), 500);
            } else {
              invoke('adb_press_back', { deviceId })
                .then(() => {
                  addLog(`✅ Back button pressed`);
                  setTimeout(() => resolve(true), 500);
                })
                .catch((err) => {
                  addLog(`❌ Back failed: ${err}`);
                  resolve(false);
                });
            }
            break;

          case 'home':
            addLog(`🏠 Pressing home button...`);
            const homeCmd = platform === 'ios' ? 'ios_press_home' : 'adb_press_home';
            invoke(homeCmd, { deviceId })
              .then(() => {
                addLog(`✅ Home button pressed`);
                setTimeout(() => resolve(true), 500);
              })
              .catch((err) => {
                addLog(`❌ Home failed: ${err}`);
                resolve(false);
              });
            break;

          case 'launch':
            if (step.config.packageName) {
              addLog(`🚀 Launching ${step.config.packageName}...`);
              const launchCmd = platform === 'ios' ? 'ios_launch_app' : 'adb_launch_app';
              const launchParams = platform === 'ios'
                ? { bundleId: step.config.packageName, deviceId }
                : { deviceId, packageName: step.config.packageName };
              invoke(launchCmd, launchParams)
                .then(() => {
                  addLog(`✅ App launched`);
                  setTimeout(() => resolve(true), 2000); // Give app time to start
                })
                .catch((err) => {
                  addLog(`❌ Launch failed: ${err}`);
                  resolve(false);
                });
            } else {
              addLog(`⚠️ Missing package name for launch step`);
              resolve(true);
            }
            break;

          default:
            resolve(true);
        }
      } catch (error) {
        addLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        resolve(false);
      }
    });
  }, [deviceId]);

  const runAllSteps = async () => {
    const startTime = Date.now();
    setIsRunning(true);
    setShowLogs(true);
    setExecutionLogs([]);
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending' as const })));

    addLog('🚀 Starting test execution...');
    addLog(`📋 Target: ${appBaseUrl || 'Demo Page'}`);

    // Run visual preview in iframe for real-time feedback
    const runVisualPreview = async () => {
      addLog('👁 Running visual preview...');
      for (const step of steps) {
        setActiveStepId(step.id);
        addLog(`▶️ ${step.label}`);
        setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'running' as const } : s));
        await executeStepLive(step);
        // Don't update status here - let Cypress results determine final status
      }
      addLog('👁 Visual preview completed');
    };

    // Start visual preview (don't await - run in parallel)
    runVisualPreview();

    // Run Cypress for real verification
    addLog('🧪 Running verification in background...');

    try {
      const testRunnerUrl = 'http://localhost:8082';

      // Map frontend steps to Cypress-compatible format
      const mapStepToCypress = (step: TestStep) => {
        const baseStep = {
          id: step.id,
          description: step.label,
        };

        switch (step.type) {
          case 'navigate':
            return { ...baseStep, action: 'visit', value: step.config.url };
          case 'type':
            return { ...baseStep, action: 'type', selector: step.config.selector, value: step.config.value };
          case 'click':
            return { ...baseStep, action: 'click', selector: step.config.selector };
          case 'wait':
            return { ...baseStep, action: 'wait', value: String(step.config.timeout || 1000) };
          case 'verify':
            // Generate assertion based on config
            const assertions = [];
            if (step.config.expected) {
              // Check URL doesn't contain the login page (means redirect happened)
              assertions.push({
                type: 'url',
                operator: 'not.include',
                expected: step.config.expected, // e.g., '/login'
              });
            }
            if (step.config.selector) {
              assertions.push({
                type: 'visible',
                selector: step.config.selector,
              });
            }
            return { ...baseStep, action: 'assert', assertions };
          default:
            return { ...baseStep, action: step.type };
        }
      };

      const scenarioData = {
        id: scenarioId,
        name: testCaseInfo.name,
        targetUrl: appBaseUrl || 'http://localhost:8081',
        steps: steps.map(mapStepToCypress),
      };

      addLog(`📡 Connecting to test runner at ${testRunnerUrl}...`);

      const response = await fetch(`${testRunnerUrl}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId,
          scenario: scenarioData,
          options: {
            browser: 'chrome',
            headless: false,
            video: true,
            screenshots: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Test runner responded with ${response.status}`);
      }

      const result = await response.json();
      addLog(`📋 Execution ID: ${result.executionId}`);
      addLog('🔄 Running test...');

      // Poll for results
      const pollResults = async () => {
        try {
          const statusResponse = await fetch(`${testRunnerUrl}/api/executions/${result.executionId}`);
          const data = await statusResponse.json();

          // BullMQ job states: 'completed', 'failed', 'active', 'waiting', 'delayed'
          if (data.jobStatus === 'completed') {
            addLog('✅ Test execution completed!');
            const duration = Date.now() - startTime;
            const passedCount = data.testResults?.passed || 0;
            const failedCount = data.testResults?.failed || 0;

            // Update all steps based on test results
            if (data.testsPassed) {
              setSteps(prev => prev.map(s => ({ ...s, status: 'passed' as const })));
              addLog('🎉 All assertions passed!');
              addLog(`📊 Results: ${passedCount} passed, ${failedCount} failed`);
            } else {
              setSteps(prev => prev.map(s => ({ ...s, status: 'failed' as const })));
              addLog(`❌ Test failed: ${failedCount} failures`);
            }

            // Save test run to localStorage for Runs page
            const startedAt = new Date(Date.now() - duration).toISOString();
            saveTestRun({
              id: result.executionId,
              name: testCaseInfo.name,
              scenarioId: scenarioId,
              status: data.testsPassed ? 'passed' : 'failed',
              duration: formatDuration(duration),
              timestamp: new Date().toLocaleString(),
              passed: passedCount,
              failed: failedCount,
              total: steps.length,
              startedAt,
              projectId: currentProject?.id,
              scenario: {
                id: scenarioId,
                name: testCaseInfo.name,
                steps: steps.map(s => ({ id: s.id, type: s.type, label: s.label })),
              },
            });
            addLog('💾 Results saved to run history');

            setIsRunning(false);
          } else if (data.jobStatus === 'failed') {
            addLog(`❌ Test execution failed`);
            const duration = Date.now() - startTime;
            setSteps(prev => prev.map(s => ({ ...s, status: 'failed' as const })));

            // Save failed test run
            const failedStartedAt = new Date(Date.now() - duration).toISOString();
            saveTestRun({
              id: result.executionId,
              name: testCaseInfo.name,
              scenarioId: scenarioId,
              status: 'failed',
              duration: formatDuration(duration),
              timestamp: new Date().toLocaleString(),
              passed: 0,
              failed: steps.length,
              total: steps.length,
              startedAt: failedStartedAt,
              projectId: currentProject?.id,
              scenario: {
                id: scenarioId,
                name: testCaseInfo.name,
                steps: steps.map(s => ({ id: s.id, type: s.type, label: s.label })),
              },
            });
            setIsRunning(false);
          } else if (data.jobStatus === 'active') {
            // Test is running
            const progress = data.progress || 0;
            if (progress > 0) {
              addLog(`⏳ Progress: ${progress}%`);
            }
            setTimeout(pollResults, 1000);
          } else {
            // waiting, delayed, or other states
            setTimeout(pollResults, 1000);
          }
        } catch (pollError) {
          addLog(`⚠️ Error polling status: ${pollError instanceof Error ? pollError.message : 'Unknown'}`);
          setTimeout(pollResults, 2000);
        }
      };

      pollResults();

    } catch (error) {
      const duration = Date.now() - startTime;
      addLog(`❌ Failed to connect to test runner: ${error instanceof Error ? error.message : 'Unknown error'}`);
      addLog('💡 Make sure the test runner is running on port 8082');
      addLog('   Run: cd services/test-runner && npm run dev');
      setSteps(prev => prev.map(s => ({ ...s, status: 'failed' })));

      // Save failed test run due to connection error
      const errorStartedAt = new Date(Date.now() - duration).toISOString();
      saveTestRun({
        id: `local-${Date.now()}`,
        name: testCaseInfo.name,
        scenarioId: scenarioId,
        status: 'failed',
        duration: formatDuration(duration),
        timestamp: new Date().toLocaleString(),
        passed: 0,
        failed: steps.length,
        total: steps.length,
        startedAt: errorStartedAt,
        projectId: currentProject?.id,
        scenario: {
          id: scenarioId,
          name: testCaseInfo.name,
          steps: steps.map(s => ({ id: s.id, type: s.type, label: s.label })),
        },
      });
      setIsRunning(false);
    }
  };

  const runSingleStep = async (step: TestStep) => {
    setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: 'running' as const } : s));
    const success = await executeStepLive(step);
    setSteps(prev => prev.map(s => s.id === step.id ? { ...s, status: success ? 'passed' as const : 'failed' as const } : s));
  };

  const handleBack = () => {
    router.push('/test-cases');
  };

  const getStepIcon = (step: TestStep) => {
    if (step.status === 'running') return <FontAwesomeIcon icon={faSpinner} className="animate-spin text-primary" />;
    if (step.status === 'passed') return <FontAwesomeIcon icon={faCheck} className="text-green-500" />;
    if (step.status === 'failed') return <FontAwesomeIcon icon={faTimes} className="text-red-500" />;
    return <FontAwesomeIcon icon={faGripVertical} className="text-gray-300" />;
  };

  const getStepTypeColor = (type: StepType) => {
    const colors: Record<StepType, string> = {
      navigate: 'bg-blue-100 text-blue-700',
      type: 'bg-purple-100 text-purple-700',
      click: 'bg-orange-100 text-orange-700',
      wait: 'bg-gray-100 text-gray-700',
      verify: 'bg-green-100 text-green-700',
      // Mobile step types
      tap: 'bg-teal-100 text-teal-700',
      swipe: 'bg-cyan-100 text-cyan-700',
      input: 'bg-purple-100 text-purple-700',
      back: 'bg-slate-100 text-slate-700',
      home: 'bg-slate-100 text-slate-700',
      launch: 'bg-emerald-100 text-emerald-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  // Calculate scaled dimensions
  const scaledWidth = (deviceWidth * zoom) / 100;
  const scaledHeight = (deviceHeight * zoom) / 100;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <FontAwesomeIcon icon={faArrowLeft} className="text-gray-600" />
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <h1 className="text-sm font-semibold text-gray-900">{testCaseInfo.scenario}</h1>
            <p className="text-xs text-gray-500">{testCaseInfo.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={runAllSteps} disabled={isRunning} className="!px-4 !py-2">
            <FontAwesomeIcon icon={isRunning ? faSpinner : faPlay} className={`mr-2 text-sm ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Run Test'}
          </Button>
          <Button className="!px-4 !py-2">Save</Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Steps */}
        <aside className={`${leftPanelOpen ? 'w-72' : 'w-0'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Test Steps</h2>
              <span className="text-xs text-gray-400">{steps.length} steps</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  activeStepId === step.id
                    ? 'bg-primary/5 ring-2 ring-primary/20'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getStepIcon(step)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{step.label}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStepTypeColor(step.type)}`}>
                      {step.type}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); runSingleStep(step); }}
                    disabled={isRunning}
                    className="p-1.5 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FontAwesomeIcon icon={faPlay} className="text-xs text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400">Add Step</p>
              {isMobileMode ? (
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 py-1 px-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-xs font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={aiLoading ? faSpinner : faRobot} className={aiLoading ? 'animate-spin' : ''} />
                  AI Suggest
                </button>
              ) : (
                <button
                  onClick={handleWebAiSuggest}
                  disabled={webAiLoading}
                  className="flex items-center gap-1.5 py-1 px-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-xs font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={webAiLoading ? faSpinner : faRobot} className={webAiLoading ? 'animate-spin' : ''} />
                  AI Suggest
                </button>
              )}
            </div>
            {isMobileMode ? (
              <div className="flex flex-wrap gap-1">
                {(['tap', 'swipe', 'input', 'wait', 'back'] as StepType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => addStep(type)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${getStepTypeColor(type)} hover:opacity-80`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1">
                {(['type', 'click', 'wait'] as StepType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => addStep(type)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${getStepTypeColor(type)} hover:opacity-80`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Toggle Left Panel */}
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className="w-5 bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <FontAwesomeIcon icon={leftPanelOpen ? faChevronLeft : faChevronRight} className="text-gray-400 text-xs" />
        </button>

        {/* Center - Preview */}
        <main className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
          {/* Preview Toolbar */}
          <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              {/* Device Selector */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {(['desktop', 'tablet', 'mobile'] as DeviceType[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDevice(d)}
                    className={`p-2 rounded-md transition-colors ${device === d ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    title={deviceSizes[d].label}
                  >
                    <FontAwesomeIcon icon={d === 'desktop' ? faDesktop : d === 'tablet' ? faTabletAlt : faMobileAlt} />
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">{deviceWidth} × {deviceHeight}</span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(prev => Math.max(50, prev - 25))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={zoom <= 50}
              >
                <FontAwesomeIcon icon={faSearchMinus} className="text-gray-500" />
              </button>
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 border-0 focus:ring-2 focus:ring-primary/20"
              >
                {zoomLevels.map(z => (
                  <option key={z} value={z}>{z}%</option>
                ))}
              </select>
              <button
                onClick={() => setZoom(prev => Math.min(150, prev + 25))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={zoom >= 150}
              >
                <FontAwesomeIcon icon={faSearchPlus} className="text-gray-500" />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Reset to 100%"
              >
                <FontAwesomeIcon icon={faExpand} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* URL Bar - only for web mode */}
          {!isMobileMode && (
            <div className="px-4 py-2 bg-white border-b border-gray-200">
              <div className="flex items-center gap-3 max-w-3xl mx-auto">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <input
                  type="text"
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Mobile Info Bar */}
          {isMobileMode && (
            <div className="px-4 py-2 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between max-w-3xl mx-auto">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={faMobileAlt} className="text-primary" />
                  <span className="text-sm font-medium">{packageName}</span>
                </div>
                <span className="text-xs text-gray-500">Click on device to interact</span>
              </div>
            </div>
          )}

          {/* Preview Area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-center min-h-full">
              {isMobileMode ? (
                <MobilePreview
                  deviceId={deviceId}
                  packageName={packageName}
                  platform={platform}
                  isRunning={isRunning}
                  refreshInterval={isRunning ? 200 : 500}
                  showControls={!isRunning}
                  onTap={(x, y, success) => {
                    if (success) {
                      addLog(`✅ Tapped at (${x}, ${y})`);
                    } else {
                      addLog(`❌ Tap failed at (${x}, ${y})`);
                    }
                  }}
                  onTapError={(error) => {
                    showToast(`Tap failed: ${error}. Try using AI Find Coordinates to fix.`, 'error');
                  }}
                />
              ) : (
                <div
                  className="bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
                  style={{
                    width: scaledWidth,
                    height: scaledHeight,
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    src={previewUrl}
                    className="border-0"
                    style={{
                      width: deviceWidth,
                      height: deviceHeight,
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'top left',
                    }}
                    title="Preview"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Execution Log */}
          {showLogs && (
            <div className="h-48 bg-gray-900 border-t border-gray-700">
              <div className="px-4 py-2 bg-gray-800 flex justify-between items-center">
                <span className="text-xs text-gray-300 font-medium">Execution Log</span>
                <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-white text-xs">
                  Hide
                </button>
              </div>
              <div className="h-36 overflow-y-auto p-3 font-mono text-xs">
                {executionLogs.map((log, index) => (
                  <div key={index} className="text-gray-300 mb-1">{log}</div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Toggle Right Panel */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="w-5 bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <FontAwesomeIcon icon={rightPanelOpen ? faChevronRight : faChevronLeft} className="text-gray-400 text-xs" />
        </button>

        {/* Right Panel - Config */}
        <aside className={`${rightPanelOpen ? 'w-80' : 'w-0'} bg-white border-l border-gray-200 flex flex-col transition-all duration-300 overflow-hidden`}>
          {activeStep && (
            <>
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Configure Step</h2>
                  <button
                    onClick={() => deleteStep(activeStep.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-sm" />
                  </button>
                </div>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${getStepTypeColor(activeStep.type)}`}>
                  {activeStep.type}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Step Label</label>
                  <input
                    type="text"
                    value={activeStep.label}
                    onChange={(e) => updateStepLabel(activeStep.id, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                {activeStep.type === 'navigate' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">URL</label>
                    <input
                      type="text"
                      value={activeStep.config.url || ''}
                      onChange={(e) => updateStepConfig(activeStep.id, 'url', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                )}

                {activeStep.type === 'type' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">CSS Selector</label>
                      <input
                        type="text"
                        value={activeStep.config.selector || ''}
                        onChange={(e) => updateStepConfig(activeStep.id, 'selector', e.target.value)}
                        placeholder="#email, input[name='email']"
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Value to Type</label>
                      <input
                        type="text"
                        value={activeStep.config.value || ''}
                        onChange={(e) => updateStepConfig(activeStep.id, 'value', e.target.value)}
                        placeholder="Enter text..."
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>

                    {/* AI Find Selector Button for Type steps */}
                    {!isMobileMode && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">
                          <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500 mr-1" />
                          Can't find the selector? Let AI help
                        </p>
                        <button
                          onClick={() => handleAiFindSelector(activeStep.id, activeStep.label)}
                          disabled={findingSelector}
                          className="w-full py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <FontAwesomeIcon icon={findingSelector ? faSpinner : faRobot} className={findingSelector ? 'animate-spin' : ''} />
                          {findingSelector ? 'Finding...' : 'AI Find Selector'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {activeStep.type === 'click' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">CSS Selector</label>
                      <input
                        type="text"
                        value={activeStep.config.selector || ''}
                        onChange={(e) => updateStepConfig(activeStep.id, 'selector', e.target.value)}
                        placeholder="button[type='submit']"
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
                      />
                    </div>

                    {/* AI Find Selector Button for Click steps */}
                    {!isMobileMode && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">
                          <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500 mr-1" />
                          Can't find the selector? Let AI help
                        </p>
                        <button
                          onClick={() => handleAiFindSelector(activeStep.id, activeStep.label)}
                          disabled={findingSelector}
                          className="w-full py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <FontAwesomeIcon icon={findingSelector ? faSpinner : faRobot} className={findingSelector ? 'animate-spin' : ''} />
                          {findingSelector ? 'Finding...' : 'AI Find Selector'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeStep.type === 'wait' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Duration (ms)</label>
                    <input
                      type="number"
                      value={activeStep.config.timeout || 1000}
                      onChange={(e) => updateStepConfig(activeStep.id, 'timeout', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                )}

                {activeStep.type === 'verify' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Element Selector (optional)</label>
                      <input
                        type="text"
                        value={activeStep.config.selector || ''}
                        onChange={(e) => updateStepConfig(activeStep.id, 'selector', e.target.value)}
                        placeholder=".success-message, #dashboard"
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
                      />
                      <p className="text-xs text-gray-400 mt-1">Verify this element is visible</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">URL Should NOT Contain</label>
                      <input
                        type="text"
                        value={activeStep.config.expected || ''}
                        onChange={(e) => updateStepConfig(activeStep.id, 'expected', e.target.value)}
                        placeholder="/login, /error"
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                      <p className="text-xs text-gray-400 mt-1">Verify the URL doesn't contain this path (e.g., after login redirect)</p>
                    </div>
                  </>
                )}

                {/* Mobile step types */}
                {activeStep.type === 'tap' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">X Coordinate</label>
                        <input
                          type="number"
                          value={activeStep.config.x || 540}
                          onChange={(e) => updateStepConfig(activeStep.id, 'x', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Y Coordinate</label>
                        <input
                          type="number"
                          value={activeStep.config.y || 960}
                          onChange={(e) => updateStepConfig(activeStep.id, 'y', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Click on the device preview to set coordinates</p>

                    {/* AI Find Coordinates Button */}
                    {isMobileMode && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">
                          <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500 mr-1" />
                          Not working? Let AI find the correct coordinates
                        </p>
                        <button
                          onClick={() => handleAiFindCoordinates(activeStep.id, activeStep.label)}
                          disabled={findingCoordinates}
                          className="w-full py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <FontAwesomeIcon icon={findingCoordinates ? faSpinner : faRobot} className={findingCoordinates ? 'animate-spin' : ''} />
                          {findingCoordinates ? 'Finding...' : 'AI Find Coordinates'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeStep.type === 'swipe' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Start X</label>
                        <input
                          type="number"
                          value={activeStep.config.x || 540}
                          onChange={(e) => updateStepConfig(activeStep.id, 'x', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Y</label>
                        <input
                          type="number"
                          value={activeStep.config.y || 1200}
                          onChange={(e) => updateStepConfig(activeStep.id, 'y', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">End X</label>
                        <input
                          type="number"
                          value={activeStep.config.x2 || 540}
                          onChange={(e) => updateStepConfig(activeStep.id, 'x2', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">End Y</label>
                        <input
                          type="number"
                          value={activeStep.config.y2 || 600}
                          onChange={(e) => updateStepConfig(activeStep.id, 'y2', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Duration (ms)</label>
                      <input
                        type="number"
                        value={activeStep.config.duration || 300}
                        onChange={(e) => updateStepConfig(activeStep.id, 'duration', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </>
                )}

                {activeStep.type === 'input' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Text to Input</label>
                    <input
                      type="text"
                      value={activeStep.config.value || ''}
                      onChange={(e) => updateStepConfig(activeStep.id, 'value', e.target.value)}
                      placeholder="Enter text..."
                      className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <p className="text-xs text-gray-400 mt-1">Text will be typed into the currently focused field</p>
                  </div>
                )}

                {activeStep.type === 'launch' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Package Name</label>
                    <input
                      type="text"
                      value={activeStep.config.packageName || ''}
                      onChange={(e) => updateStepConfig(activeStep.id, 'packageName', e.target.value)}
                      placeholder="com.example.app"
                      className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
                    />
                  </div>
                )}

                {(activeStep.type === 'back' || activeStep.type === 'home') && (
                  <p className="text-sm text-gray-500">
                    This step will press the {activeStep.type === 'back' ? 'Back' : 'Home'} button on the device.
                  </p>
                )}
              </div>

              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => runSingleStep(activeStep)}
                  disabled={isRunning}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faPlay} className="mr-2" />
                  Run This Step
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce-in ${
            toast.type === 'error'
              ? 'bg-red-500 text-white'
              : toast.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-white'
          }`}
        >
          <FontAwesomeIcon
            icon={toast.type === 'error' ? faTimes : toast.type === 'success' ? faCheck : faSpinner}
          />
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 p-1 hover:bg-white/20 rounded"
          >
            <FontAwesomeIcon icon={faTimes} className="text-sm" />
          </button>
        </div>
      )}

      {/* AI Suggestion Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <FontAwesomeIcon icon={faRobot} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">AI Step Suggestions</h2>
                  <p className="text-xs text-gray-500">Based on current screen analysis</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FontAwesomeIcon icon={faSpinner} className="text-4xl text-purple-500 animate-spin mb-4" />
                  <p className="text-gray-600 font-medium">Analyzing screen...</p>
                  <p className="text-sm text-gray-400 mt-1">AI is detecting UI elements and suggesting test steps</p>
                </div>
              ) : aiError ? (
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-red-600 font-medium mb-2">Analysis Failed</p>
                  <p className="text-sm text-red-500">{aiError}</p>
                  <button
                    onClick={handleAiSuggest}
                    className="mt-3 px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  {/* Screen Description */}
                  {aiScreenDescription && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faLightbulb} className="text-purple-500" />
                        <span className="text-sm font-medium text-purple-700">Screen Analysis</span>
                      </div>
                      <p className="text-sm text-purple-600">{aiScreenDescription}</p>
                    </div>
                  )}

                  {/* Suggested Steps */}
                  {aiSuggestions.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          {aiSuggestions.length} suggested steps
                        </p>
                        <button
                          onClick={addAllAiSuggestions}
                          className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium hover:bg-purple-600 transition-colors"
                        >
                          Add All Steps
                        </button>
                      </div>

                      {aiSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="p-3 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStepTypeColor(suggestion.step_type as StepType)}`}>
                                  {suggestion.step_type}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {Math.round(suggestion.confidence * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-sm font-medium text-gray-900">{suggestion.label}</p>
                              {suggestion.config.element_description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Target: {suggestion.config.element_description}
                                </p>
                              )}
                              {(suggestion.config.x !== undefined && suggestion.config.y !== undefined) && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Position: ({suggestion.config.x}, {suggestion.config.y})
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                addAiSuggestedStep(suggestion);
                              }}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <FontAwesomeIcon icon={faPlus} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !aiLoading && !aiError && (
                    <div className="text-center py-8">
                      <FontAwesomeIcon icon={faRobot} className="text-4xl text-gray-300 mb-3" />
                      <p className="text-gray-500">No suggestions yet</p>
                      <p className="text-sm text-gray-400 mt-1">Click "AI Suggest" to analyze the current screen</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              {!aiLoading && aiSuggestions.length === 0 && !aiError && (
                <button
                  onClick={handleAiSuggest}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-600 transition-all"
                >
                  Analyze Screen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Web AI Suggestion Modal */}
      {showWebAiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <FontAwesomeIcon icon={faRobot} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">AI Web Test Suggestions</h2>
                  <p className="text-xs text-gray-500">Based on web page analysis</p>
                </div>
              </div>
              <button
                onClick={() => setShowWebAiModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {webAiLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FontAwesomeIcon icon={faSpinner} className="text-4xl text-purple-500 animate-spin mb-4" />
                  <p className="text-gray-600 font-medium">Analyzing web page...</p>
                  <p className="text-sm text-gray-400 mt-1">AI is detecting UI elements and suggesting test steps</p>
                </div>
              ) : webAiError ? (
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-red-600 font-medium mb-2">Analysis Failed</p>
                  <p className="text-sm text-red-500">{webAiError}</p>
                  <button
                    onClick={handleWebAiSuggest}
                    className="mt-3 px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  {/* Page Description */}
                  {webAiPageDescription && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faLightbulb} className="text-purple-500" />
                        <span className="text-sm font-medium text-purple-700">Page Analysis</span>
                      </div>
                      <p className="text-sm text-purple-600">{webAiPageDescription}</p>
                    </div>
                  )}

                  {/* Suggested Steps */}
                  {webAiSuggestions.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          {webAiSuggestions.length} suggested steps
                        </p>
                        <button
                          onClick={addAllWebAiSuggestions}
                          className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium hover:bg-purple-600 transition-colors"
                        >
                          Add All Steps
                        </button>
                      </div>

                      {webAiSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="p-3 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStepTypeColor(suggestion.step_type as StepType)}`}>
                                  {suggestion.step_type}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {Math.round(suggestion.confidence * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-sm font-medium text-gray-900">{suggestion.label}</p>
                              {suggestion.config.selector && (
                                <p className="text-xs text-gray-500 mt-1 font-mono">
                                  Selector: {suggestion.config.selector}
                                </p>
                              )}
                              {suggestion.config.url && (
                                <p className="text-xs text-gray-500 mt-1">
                                  URL: {suggestion.config.url}
                                </p>
                              )}
                              {suggestion.config.value && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Value: {suggestion.config.value}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                addWebAiSuggestedStep(suggestion);
                              }}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <FontAwesomeIcon icon={faPlus} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !webAiLoading && !webAiError && (
                    <div className="text-center py-8">
                      <FontAwesomeIcon icon={faRobot} className="text-4xl text-gray-300 mb-3" />
                      <p className="text-gray-500">No suggestions yet</p>
                      <p className="text-sm text-gray-400 mt-1">Click "Analyze Page" to get AI suggestions</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowWebAiModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              {!webAiLoading && webAiSuggestions.length === 0 && !webAiError && (
                <button
                  onClick={handleWebAiSuggest}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-600 transition-all"
                >
                  Analyze Page
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
