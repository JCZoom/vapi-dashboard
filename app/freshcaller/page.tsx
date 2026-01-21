'use client';

import { useState, useEffect } from 'react';
import FreshcallerMonitor from '@/components/FreshcallerMonitor';

export default function FreshcallerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authenticated = sessionStorage.getItem('vapi_dashboard_auth') === 'true';
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-white mb-4">Access Required</h1>
          <p className="text-gray-400 mb-4">
            Please authenticate via the main dashboard first.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <a
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </a>
            <h1 className="text-2xl font-bold">Freshcaller Integration</h1>
          </div>
        </div>

        {/* Monitor Component */}
        <FreshcallerMonitor autoRefresh={true} refreshInterval={10000} />
      </div>
    </div>
  );
}
