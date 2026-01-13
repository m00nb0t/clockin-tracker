'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EmployeeManagement from './components/EmployeeManagement';
import QuizManagement from './components/QuizManagement';
import SalesManagement from './components/SalesManagement';
import CreatorManagement from './components/CreatorManagement';
import DisputeManagement from './components/DisputeManagement';
import ClockTimeManagement from './components/ClockTimeManagement';
import QuizResponses from './components/QuizResponses';
import ErrorBoundary from '@/components/ErrorBoundary';

// Telegram WebApp type declarations
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: any;
        version: string;
        platform: string;
        colorScheme: string;
        themeParams: any;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        expand(): void;
        close(): void;
        showPopup(params: any): void;
        showAlert(message: string): void;
        showConfirm(message: string): Promise<boolean>;
        enableClosingConfirmation(): void;
        disableClosingConfirmation(): void;
        onEvent(eventType: string, eventHandler: Function): void;
        offEvent(eventType: string, eventHandler: Function): void;
        sendData(data: string): void;
        switchInlineQuery(query: string, choose_chat_types?: string[]): void;
        openLink(url: string): void;
        openTelegramLink(url: string): void;
        openInvoice(url: string): void;
        showScanQrPopup(params: any): void;
        closeScanQrPopup(): void;
        readTextFromClipboard(): Promise<string>;
        requestWriteAccess(): Promise<boolean>;
        requestContact(): Promise<any>;
        ready(): void;
        MainButton: any;
        BackButton: any;
        SettingsButton: any;
      };
    };
  }
}

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  todayClockIns: number;
  todaySales: number;
  thisWeekHours: number;
  thisWeekSales: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored admin token
    const storedToken = localStorage.getItem('admin_token');
    if (storedToken) {
      // Verify token is still valid by making a test API call
      verifyAdminToken(storedToken);
    } else {
      // No token, prompt for password
      promptAdminLogin();
    }
  }, []);

  const promptAdminLogin = () => {
    const enteredPassword = prompt('Enter admin password:');
    if (enteredPassword) {
      // Hash the entered password using Web Crypto API
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(enteredPassword))
        .then(hashBuffer => {
          const enteredHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

          const correctHash = '8e141a729043fb8b3d060a9476fc1a891cd712a9c84756e28b0b5010de82e6de';

          if (enteredHash === correctHash) {
            // Password correct, get admin token from API
            fetch('/api/admin/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: enteredPassword })
            })
            .then(response => response.json())
            .then(data => {
              if (data.token) {
                localStorage.setItem('admin_token', data.token);
                setAdminToken(data.token);
                fetchStats(data.token);
              } else {
                alert('Login failed');
                window.location.href = '/';
              }
            })
            .catch(error => {
              console.error('Login error:', error);
              alert('Login failed');
              window.location.href = '/';
            });
          } else {
            alert('Incorrect password');
            window.location.href = '/';
          }
        });
    } else {
      window.location.href = '/';
    }
  };

  const verifyAdminToken = (token: string) => {
    fetch('/api/admin/verify-token', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
      if (response.ok) {
        setAdminToken(token);
        fetchStats(token);
      } else {
        // Token invalid, clear it and prompt login
        localStorage.removeItem('admin_token');
        promptAdminLogin();
      }
    })
    .catch(() => {
      localStorage.removeItem('admin_token');
      promptAdminLogin();
    });
  };

  const fetchStats = async (token?: string) => {
    const currentToken = token || adminToken;
    if (!currentToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'employees', label: 'Employees' },
    { id: 'creators', label: 'Creators' },
    { id: 'clock-times', label: 'Shifts' },
    { id: 'sales', label: 'Sales' },
    { id: 'quiz', label: 'Quiz Setup' },
    { id: 'quiz-results', label: 'Quiz Results' },
    { id: 'disputes', label: 'Tip Disputes' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
            <div className="text-sm text-gray-500">
              ClockIn Tracker
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="p-6">
        <ErrorBoundary>
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Employees</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats?.totalEmployees || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Today</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats?.todayClockIns || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                    <p className="text-2xl font-semibold text-gray-900">${(stats?.todaySales || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Week Hours</p>
                    <p className="text-2xl font-semibold text-gray-900">{(stats?.thisWeekHours || 0).toFixed(1)}h</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-500 text-center py-8">Activity feed coming soon...</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && <EmployeeManagement token={adminToken!} />}

        {activeTab === 'creators' && <CreatorManagement token={adminToken!} />}

        {activeTab === 'disputes' && <DisputeManagement token={adminToken!} />}

        {activeTab === 'clock-times' && <ClockTimeManagement token={adminToken!} />}

        {activeTab === 'sales' && <SalesManagement token={adminToken!} />}

        {activeTab === 'quiz' && <QuizManagement token={adminToken!} />}

        {activeTab === 'quiz-results' && <QuizResponses token={adminToken!} />}

        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Reports</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-500 text-center py-8">Reports interface coming soon...</p>
            </div>
          </div>
        )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
