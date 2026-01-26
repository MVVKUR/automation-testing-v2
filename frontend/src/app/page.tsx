'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Modal, Spinner } from '@/components/ui';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faAndroid, faApple } from '@fortawesome/free-brands-svg-icons';
import { faFileZipper, faCodeBranch, faGlobe, faRocket, faFlask, faHistory, faArrowRight, faMobileScreen, faLaptop, faSync } from '@fortawesome/free-solid-svg-icons';
import { useProject, Project } from '@/contexts/project-context';
import { invoke } from '@tauri-apps/api/core';

interface InstalledApp {
  package_name: string;
  app_name: string | null;
}

interface IosDevice {
  udid: string;
  name: string;
  state: string;
  runtime: string;
}

type IntegrationType = 'github' | 'gitlab' | 'upload' | 'url' | 'android' | 'ios';

const webIntegrations = [
  {
    id: 'url' as IntegrationType,
    name: 'Connect URL',
    description: 'Test a running web app',
    icon: faGlobe,
    highlight: true,
  },
  {
    id: 'github' as IntegrationType,
    name: 'GitHub',
    description: 'Clone & test repository',
    icon: faGithub,
  },
  {
    id: 'gitlab' as IntegrationType,
    name: 'GitLab',
    description: 'Clone & test repository',
    icon: faGitlab,
  },
  {
    id: 'upload' as IntegrationType,
    name: 'Upload Zip',
    description: 'Drag & drop project',
    icon: faFileZipper,
  },
];

const mobileIntegrations = [
  {
    id: 'android' as IntegrationType,
    name: 'Android',
    description: 'Test APK on emulator or device',
    icon: faAndroid,
    color: 'text-green-600',
  },
  {
    id: 'ios' as IntegrationType,
    name: 'iOS',
    description: 'Test on simulator or device',
    icon: faApple,
    color: 'text-neutral-800',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { currentProject, setCurrentProject } = useProject();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'github' | 'gitlab' | 'url' | 'android' | 'ios' | null>(null);
  const [apkPath, setApkPath] = useState('');
  const [androidMode, setAndroidMode] = useState<'install' | 'connect' | null>(null);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');

  // iOS state
  const [iosMode, setIosMode] = useState<'install' | 'connect' | null>(null);
  const [iosSimulators, setIosSimulators] = useState<IosDevice[]>([]);
  const [iosApps, setIosApps] = useState<string[]>([]);
  const [selectedIosDevice, setSelectedIosDevice] = useState('');
  const [selectedIosApp, setSelectedIosApp] = useState('');
  const [loadingIos, setLoadingIos] = useState(false);

  // Fetch installed apps when Android modal opens with "connect" mode
  const fetchInstalledApps = async () => {
    setLoadingApps(true);
    try {
      const apps = await invoke<InstalledApp[]>('adb_list_packages', { thirdPartyOnly: true });
      setInstalledApps(apps);
    } catch (err) {
      console.error('Failed to fetch installed apps:', err);
      setError('Failed to fetch installed apps. Make sure ADB is connected.');
    } finally {
      setLoadingApps(false);
    }
  };

  // Fetch apps when switching to connect mode
  useEffect(() => {
    if (modalType === 'android' && androidMode === 'connect' && installedApps.length === 0) {
      fetchInstalledApps();
    }
  }, [modalType, androidMode]);

  // Fetch iOS simulators and apps
  const fetchIosSimulators = async () => {
    setLoadingIos(true);
    try {
      const devices = await invoke<IosDevice[]>('ios_list_devices');
      setIosSimulators(devices);
      // Auto-select the first booted device
      const bootedDevice = devices.find(d => d.state === 'Booted');
      if (bootedDevice) {
        setSelectedIosDevice(bootedDevice.udid);
      } else if (devices.length > 0) {
        setSelectedIosDevice(devices[0].udid);
      }
    } catch (err) {
      console.error('Failed to fetch iOS simulators:', err);
      setError('Failed to fetch iOS simulators. Make sure Xcode is installed.');
    } finally {
      setLoadingIos(false);
    }
  };

  const fetchIosApps = async (deviceId?: string) => {
    setLoadingIos(true);
    try {
      const apps = await invoke<string[]>('ios_list_apps', { deviceId: deviceId || selectedIosDevice || undefined });
      setIosApps(apps);
    } catch (err) {
      console.error('Failed to fetch iOS apps:', err);
      // Don't show error for apps - it's optional
    } finally {
      setLoadingIos(false);
    }
  };

  // Fetch iOS data when modal opens
  useEffect(() => {
    if (modalType === 'ios' && iosSimulators.length === 0) {
      fetchIosSimulators();
    }
  }, [modalType]);

  // Fetch iOS apps when a device is selected and mode is connect
  useEffect(() => {
    if (modalType === 'ios' && iosMode === 'connect' && selectedIosDevice) {
      fetchIosApps(selectedIosDevice);
    }
  }, [modalType, iosMode, selectedIosDevice]);
  const [branch, setBranch] = useState('main');
  const [appUrl, setAppUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleIntegrationClick = (integrationId: IntegrationType) => {
    if (integrationId === 'github' || integrationId === 'gitlab') {
      setModalType(integrationId);
      setModalOpen(true);
      setRepoUrl('');
      setBranch('main');
      setError('');
    } else if (integrationId === 'url') {
      setModalType('url');
      setModalOpen(true);
      setAppUrl('http://localhost:');
      setProjectName('');
      setError('');
    } else if (integrationId === 'upload') {
      alert('File upload coming soon!');
    } else if (integrationId === 'android') {
      setModalType('android');
      setModalOpen(true);
      setProjectName('');
      setError('');
    } else if (integrationId === 'ios') {
      setModalType('ios');
      setModalOpen(true);
      setProjectName('');
      setError('');
    }
  };

  const handleConnectUrl = () => {
    if (!appUrl.trim()) {
      setError('Please enter the app URL');
      return;
    }

    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(appUrl)) {
      setError('Please enter a valid URL (e.g., http://localhost:3000)');
      return;
    }

    // Generate project name from URL if not provided
    const name = projectName.trim() || (() => {
      try {
        const url = new URL(appUrl);
        return url.hostname.replace(/[^a-zA-Z0-9]/g, '-') || 'my-app';
      } catch {
        return 'my-app';
      }
    })();

    // Set project in context
    const project: Project = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      appUrl,
      source: 'url',
      connectedAt: new Date().toISOString(),
    };

    setCurrentProject(project);
    setModalOpen(false);

    // Navigate to test cases
    router.push('/test-cases');
  };

  const handleCloneRepository = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    const urlPattern = /^https?:\/\/(github\.com|gitlab\.com)\/[\w-]+\/[\w.-]+/;
    if (!urlPattern.test(repoUrl)) {
      setError(`Please enter a valid ${modalType === 'github' ? 'GitHub' : 'GitLab'} repository URL`);
      return;
    }

    setIsLoading(true);
    setError('');

    // Extract repo name from URL
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'project';

    // Set project in context
    const project: Project = {
      id: repoName.toLowerCase().replace(/\s+/g, '-'),
      name: repoName,
      appUrl: repoUrl,
      source: modalType as 'github' | 'gitlab',
      connectedAt: new Date().toISOString(),
    };

    setCurrentProject(project);
    setModalOpen(false);
    setIsLoading(false);

    // Navigate to test cases
    router.push('/test-cases');
  };

  // If project is connected, show dashboard
  if (currentProject) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Welcome back!
          </h1>
          <p className="text-text-secondary mb-8">
            Continue testing <span className="font-medium text-neutral-900">{currentProject.name}</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              hoverable
              onClick={() => router.push('/test-cases')}
              className="p-6 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center">
                  <FontAwesomeIcon icon={faFlask} className="text-neutral-700 text-xl" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Test Cases</h3>
                  <p className="text-sm text-text-secondary">View and manage your test cases</p>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="text-neutral-400" />
              </div>
            </Card>

            <Card
              hoverable
              onClick={() => router.push('/runs')}
              className="p-6 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center">
                  <FontAwesomeIcon icon={faHistory} className="text-neutral-700 text-xl" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Run History</h3>
                  <p className="text-sm text-text-secondary">View past test executions</p>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="text-neutral-400" />
              </div>
            </Card>
          </div>

          <div className="mt-8 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <h4 className="text-sm font-medium text-text-secondary mb-2">Connected Project</h4>
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faGlobe} className="text-neutral-600" />
              <div>
                <p className="font-medium">{currentProject.name}</p>
                <p className="text-sm text-text-tertiary">{currentProject.appUrl}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No project connected - show welcome screen
  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="hero-title">Welcome to AutoTest AI</h1>
          <p className="text-base text-text-secondary">
            Connect your project to start automating tests with AI.
          </p>
        </div>

        {/* Web Testing Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faLaptop} className="text-blue-600 text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Web Testing</h2>
              <p className="text-sm text-text-secondary">Test web applications in browser</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {webIntegrations.map((integration) => (
              <div key={integration.id} className="relative">
                {integration.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-xs font-bold px-3 py-1 rounded-full z-10 whitespace-nowrap">
                    Quick Start
                  </span>
                )}
                <Card
                  hoverable
                  onClick={() => handleIntegrationClick(integration.id)}
                  className={`p-6 ${integration.highlight ? 'pt-8' : ''} flex flex-col items-center gap-3 cursor-pointer h-full ${
                    integration.highlight ? 'border-2 border-neutral-900 bg-neutral-50' : ''
                  }`}
                >
                  <FontAwesomeIcon
                    icon={integration.icon}
                    className="text-4xl text-neutral-700"
                  />
                  <h3 className="font-semibold">{integration.name}</h3>
                  <p className="text-xs text-text-secondary text-center">{integration.description}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Testing Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faMobileScreen} className="text-green-600 text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Mobile Testing</h2>
              <p className="text-sm text-text-secondary">Test native Android & iOS applications</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            {mobileIntegrations.map((integration) => (
              <Card
                key={integration.id}
                hoverable
                onClick={() => handleIntegrationClick(integration.id)}
                className="p-6 flex flex-col items-center gap-3 cursor-pointer"
              >
                <FontAwesomeIcon
                  icon={integration.icon}
                  className={`text-4xl ${integration.color || 'text-neutral-700'}`}
                />
                <h3 className="font-semibold">{integration.name}</h3>
                <p className="text-xs text-text-secondary text-center">{integration.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* GitHub/GitLab Clone Modal */}
      <Modal
        isOpen={modalOpen && (modalType === 'github' || modalType === 'gitlab')}
        onClose={() => setModalOpen(false)}
        title={`Connect ${modalType === 'github' ? 'GitHub' : 'GitLab'} Repository`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Repository URL
            </label>
            <Input
              type="url"
              placeholder={`https://${modalType}.com/username/repository`}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              <FontAwesomeIcon icon={faCodeBranch} className="mr-2" />
              Branch
            </label>
            <Input
              type="text"
              placeholder="main"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1" disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCloneRepository} className="flex-1" disabled={isLoading}>
              {isLoading ? <><Spinner className="w-4 h-4 mr-2" />Connecting...</> : 'Connect'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Connect URL Modal */}
      <Modal
        isOpen={modalOpen && modalType === 'url'}
        onClose={() => setModalOpen(false)}
        title="Connect to Running App"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-neutral-100 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg text-sm">
            <FontAwesomeIcon icon={faRocket} className="mr-2 text-neutral-600" />
            Connect directly to your running application to start testing immediately.
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              <FontAwesomeIcon icon={faGlobe} className="mr-2 text-neutral-500" />
              App URL
            </label>
            <Input
              type="url"
              placeholder="http://localhost:3000"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-text-tertiary mt-1">
              Enter the URL where your app is running
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Project Name (optional)
            </label>
            <Input
              type="text"
              placeholder="my-app"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConnectUrl} className="flex-1">
              <FontAwesomeIcon icon={faRocket} className="mr-2" />
              Start Testing
            </Button>
          </div>
        </div>
      </Modal>

      {/* Android Modal */}
      <Modal
        isOpen={modalOpen && modalType === 'android'}
        onClose={() => { setModalOpen(false); setAndroidMode(null); setSelectedPackage(''); setInstalledApps([]); setError(''); }}
        title="Android Testing"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            <FontAwesomeIcon icon={faAndroid} className="mr-2" />
            Test Android applications on emulator or physical device.
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <div
              onClick={() => setAndroidMode('install')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                androidMode === 'install'
                  ? 'border-green-500 bg-green-50'
                  : 'border-neutral-200 hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  androidMode === 'install' ? 'bg-green-200' : 'bg-green-100'
                }`}>
                  <FontAwesomeIcon icon={faFileZipper} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Install APK</h4>
                  <p className="text-xs text-text-secondary">Drag & drop or browse for APK file</p>
                </div>
                {androidMode === 'install' && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            </div>

            <div
              onClick={() => setAndroidMode('connect')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                androidMode === 'connect'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-neutral-200 hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  androidMode === 'connect' ? 'bg-blue-200' : 'bg-blue-100'
                }`}>
                  <FontAwesomeIcon icon={faMobileScreen} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Connect to Running App</h4>
                  <p className="text-xs text-text-secondary">Test app already installed on device</p>
                </div>
                {androidMode === 'connect' && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Install APK Section */}
          {androidMode === 'install' && (
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors cursor-pointer">
              <FontAwesomeIcon icon={faFileZipper} className="text-3xl text-neutral-400 mb-2" />
              <p className="text-sm font-medium text-neutral-700">Drop APK file here</p>
              <p className="text-xs text-text-secondary mt-1">or click to browse</p>
              <input type="file" accept=".apk" className="hidden" />
            </div>
          )}

          {/* Connect to App Section */}
          {androidMode === 'connect' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-text-primary">
                  Select Installed App
                </label>
                <button
                  onClick={fetchInstalledApps}
                  disabled={loadingApps}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faSync} className={loadingApps ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {loadingApps ? (
                <div className="p-8 text-center">
                  <Spinner className="mx-auto mb-2" />
                  <p className="text-sm text-text-secondary">Loading installed apps...</p>
                </div>
              ) : installedApps.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-neutral-200 rounded-lg">
                  <p className="text-sm text-text-secondary mb-2">No third-party apps found</p>
                  <button
                    onClick={fetchInstalledApps}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Click to scan device
                  </button>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {installedApps.map((app) => (
                    <div
                      key={app.package_name}
                      onClick={() => { setSelectedPackage(app.package_name); setProjectName(app.package_name.split('.').pop() || 'app'); }}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all flex items-center gap-3 ${
                        selectedPackage === app.package_name
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <span className="text-2xl">📱</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{app.app_name || app.package_name.split('.').pop()}</p>
                        <p className="text-xs text-text-secondary font-mono truncate">{app.package_name}</p>
                      </div>
                      {selectedPackage === app.package_name && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Project Name - show when mode is selected */}
          {androidMode && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Project Name
              </label>
              <Input
                type="text"
                placeholder="my-android-app"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Detected Devices */}
          <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-3">
            <p className="text-xs text-text-secondary">
              <span className="font-medium text-neutral-700">Detected Devices:</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm">emulator-5554 (Android Emulator)</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setAndroidMode(null); }} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!androidMode || (androidMode === 'connect' && !selectedPackage)}
              onClick={() => {
                const project: Project = {
                  id: (projectName || 'android-app').toLowerCase().replace(/\s+/g, '-'),
                  name: projectName || 'Android App',
                  appUrl: `android://${selectedPackage || 'app'}`,
                  source: 'android',
                  connectedAt: new Date().toISOString(),
                  packageName: selectedPackage || undefined,
                  deviceId: 'emulator-5554',
                };
                setCurrentProject(project);
                setModalOpen(false);
                setAndroidMode(null);
                router.push('/test-cases');
              }}
              className="flex-1"
            >
              <FontAwesomeIcon icon={faAndroid} className="mr-2" />
              Start Testing
            </Button>
          </div>
        </div>
      </Modal>

      {/* iOS Modal */}
      <Modal
        isOpen={modalOpen && modalType === 'ios'}
        onClose={() => { setModalOpen(false); setIosMode(null); }}
        title="iOS Testing"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-neutral-100 border border-neutral-200 text-neutral-800 px-4 py-3 rounded-lg text-sm">
            <FontAwesomeIcon icon={faApple} className="mr-2" />
            Test iOS applications on simulator or physical device.
          </div>

          <div className="space-y-3">
            <div
              onClick={() => setIosMode('install')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                iosMode === 'install' ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-200 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faFileZipper} className="text-neutral-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Install IPA / App</h4>
                  <p className="text-xs text-text-secondary">Drag & drop or browse for app file</p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setIosMode('connect')}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                iosMode === 'connect' ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon icon={faMobileScreen} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Connect to Running App</h4>
                  <p className="text-xs text-text-secondary">Test app already installed on simulator</p>
                </div>
              </div>
            </div>
          </div>

          {/* Simulator selector */}
          <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-700">Available Simulators:</span>
              <button onClick={fetchIosSimulators} className="text-xs text-blue-600 hover:text-blue-800">
                <FontAwesomeIcon icon={faSync} className={loadingIos ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            {loadingIos && iosSimulators.length === 0 ? (
              <div className="py-2 text-center">
                <Spinner className="mx-auto" />
              </div>
            ) : iosSimulators.length === 0 ? (
              <p className="text-xs text-text-secondary">No simulators found. Start a simulator in Xcode.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {iosSimulators.map((sim) => (
                  <div
                    key={sim.udid}
                    onClick={() => setSelectedIosDevice(sim.udid)}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      selectedIosDevice === sim.udid ? 'bg-blue-100' : 'hover:bg-neutral-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${sim.state === 'Booted' ? 'bg-green-500' : 'bg-neutral-400'}`}></span>
                    <span className="text-sm">{sim.name}</span>
                    <span className="text-xs text-text-secondary">
                      ({sim.runtime.replace('com.apple.CoreSimulator.SimRuntime.', '').replace('-', ' ')})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* App selector when connect mode is selected */}
          {iosMode === 'connect' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Select App (Bundle ID)
              </label>
              {loadingIos ? (
                <div className="p-4 text-center border border-neutral-200 rounded-lg">
                  <Spinner className="mx-auto mb-2" />
                  <p className="text-sm text-text-secondary">Loading apps...</p>
                </div>
              ) : iosApps.length === 0 ? (
                <div className="p-4 text-center border-2 border-dashed border-neutral-200 rounded-lg">
                  <p className="text-sm text-text-secondary mb-2">No apps found or enter manually</p>
                  <Input
                    type="text"
                    placeholder="com.example.myapp"
                    value={selectedIosApp}
                    onChange={(e) => setSelectedIosApp(e.target.value)}
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 border border-neutral-200 rounded-lg p-2">
                  {iosApps.map((app) => (
                    <div
                      key={app}
                      onClick={() => { setSelectedIosApp(app); setProjectName(app.split('.').pop() || 'app'); }}
                      className={`p-2 rounded cursor-pointer text-sm ${
                        selectedIosApp === app ? 'bg-blue-100 border border-blue-500' : 'hover:bg-neutral-100'
                      }`}
                    >
                      📱 {app}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Project Name
            </label>
            <Input
              type="text"
              placeholder="my-ios-app"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setIosMode(null); }} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!iosMode || !selectedIosDevice || (iosMode === 'connect' && !selectedIosApp)}
              onClick={() => {
                const project: Project = {
                  id: (projectName || 'ios-app').toLowerCase().replace(/\s+/g, '-'),
                  name: projectName || 'iOS App',
                  appUrl: `ios://${selectedIosApp || 'simulator'}`,
                  source: 'ios',
                  connectedAt: new Date().toISOString(),
                  packageName: selectedIosApp || undefined,
                  deviceId: selectedIosDevice,
                };
                setCurrentProject(project);
                setModalOpen(false);
                setIosMode(null);
                router.push('/test-cases');
              }}
              className="flex-1"
            >
              <FontAwesomeIcon icon={faApple} className="mr-2" />
              Start Testing
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
