'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome,
  faFlask,
  faHistory,
  faCog,
  faSignOutAlt,
  faGlobe,
} from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useProject } from '@/contexts/project-context';

interface NavItem {
  href: string;
  label: string;
  icon: IconDefinition;
  requiresProject?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentProject, clearProject } = useProject();

  const navItems: NavItem[] = [
    { href: '/', label: 'Home', icon: faHome },
    { href: '/test-cases', label: 'Test Cases', icon: faFlask, requiresProject: true },
    { href: '/runs', label: 'Run History', icon: faHistory, requiresProject: true },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleDisconnect = () => {
    clearProject();
    router.push('/');
  };

  // Filter nav items based on project state
  const visibleNavItems = navItems.filter(
    (item) => !item.requiresProject || currentProject
  );

  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="AutoTest AI Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <h1 className="font-bold text-lg text-text-primary">AutoTest AI</h1>
            <p className="text-xs text-text-tertiary">v1.0.0</p>
          </div>
        </Link>
      </div>

      {/* Current Project Badge */}
      {currentProject && (
        <div className="px-4 py-3 border-b border-border bg-neutral-50">
          <div className="flex items-center gap-2 text-sm">
            <FontAwesomeIcon icon={faGlobe} className="text-neutral-600 w-4" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-primary truncate">{currentProject.name}</p>
              <p className="text-xs text-text-tertiary truncate">{currentProject.appUrl}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {visibleNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="w-5 text-neutral-600" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-border space-y-1">
        {currentProject && (
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <FontAwesomeIcon icon={faSignOutAlt} className="w-5 text-neutral-600" />
            <span>Disconnect Project</span>
          </button>
        )}
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
            isActive('/settings')
              ? 'bg-neutral-100 text-neutral-900 font-medium'
              : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
          }`}
        >
          <FontAwesomeIcon icon={faCog} className="w-5 text-neutral-600" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
