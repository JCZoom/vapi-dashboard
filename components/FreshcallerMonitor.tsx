'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FreshcallerCall,
  FreshcallerCallsResponse,
  FreshcallerTeam,
  FreshcallerTeamsResponse,
  CALL_STATUS,
} from '@/lib/freshcaller-types';

interface FreshcallerMonitorProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function FreshcallerMonitor({
  autoRefresh = true,
  refreshInterval = 10000,
}: FreshcallerMonitorProps) {
  const [calls, setCalls] = useState<FreshcallerCall[]>([]);
  const [teams, setTeams] = useState<FreshcallerTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [callsRes, teamsRes] = await Promise.all([
        fetch('/api/freshcaller/calls?per_page=50'),
        fetch('/api/freshcaller/teams'),
      ]);

      if (!callsRes.ok || !teamsRes.ok) {
        throw new Error('Failed to fetch Freshcaller data');
      }

      const callsData: FreshcallerCallsResponse = await callsRes.json();
      const teamsData: FreshcallerTeamsResponse = await teamsRes.json();

      setCalls(callsData.calls || []);
      setTeams(teamsData.teams || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh, refreshInterval]);

  const getCallStatusLabel = (status: number): string => {
    return CALL_STATUS[status as keyof typeof CALL_STATUS] || `Status ${status}`;
  };

  const getCallStatusColor = (status: number): string => {
    switch (status) {
      case 0:
      case 1:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 2:
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 3:
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 4:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 5:
      case 7:
      case 8:
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 6:
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallFlow = (call: FreshcallerCall): string[] => {
    const flow: string[] = [];
    
    if (call.direction === 'incoming') {
      flow.push('📞 Incoming');
    } else {
      flow.push('📤 Outgoing');
    }

    if (call.assigned_ivr_name) {
      flow.push(`🔀 IVR: ${call.assigned_ivr_name}`);
    }

    if (call.assigned_call_queue_name) {
      flow.push(`⏳ Queue: ${call.assigned_call_queue_name}`);
    }

    if (call.assigned_team_name) {
      flow.push(`👥 Team: ${call.assigned_team_name}`);
    }

    if (call.assigned_agent_name) {
      flow.push(`🧑‍💼 Agent: ${call.assigned_agent_name}`);
    }

    if (call.external_number) {
      flow.push(`🔗 External: ${call.external_number}`);
    }

    return flow;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="text-gray-400">Loading Freshcaller data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg border border-red-700 p-6">
        <div className="text-red-400">
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeCalls = calls.filter((c) => {
    const status = c.participants[0]?.call_status;
    return status !== undefined && status <= 3;
  });

  const recentCalls = calls.slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Freshcaller Monitor</h2>
          <p className="text-sm text-gray-400">
            {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400">
            {calls.length} calls • {teams.length} teams
          </span>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Active Calls */}
      {activeCalls.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-green-700 p-4">
          <h3 className="text-lg font-medium text-green-400 mb-3 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Active Calls ({activeCalls.length})
          </h3>
          <div className="space-y-3">
            {activeCalls.map((call) => (
              <div
                key={call.id}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">
                        {call.participants[0]?.caller_number || 'Unknown'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs border ${getCallStatusColor(
                          call.participants[0]?.call_status || 0
                        )}`}
                      >
                        {getCallStatusLabel(call.participants[0]?.call_status || 0)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getCallFlow(call).map((step, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300"
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTime(call.created_time)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IVR Flow Summary */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-medium text-white mb-3">IVR Flow Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(() => {
            const ivrCounts: Record<string, number> = {};
            calls.forEach((call) => {
              if (call.assigned_ivr_name) {
                ivrCounts[call.assigned_ivr_name] =
                  (ivrCounts[call.assigned_ivr_name] || 0) + 1;
              }
            });
            return Object.entries(ivrCounts).map(([name, count]) => (
              <div
                key={name}
                className="bg-gray-800 rounded-lg p-3 border border-gray-700"
              >
                <div className="text-2xl font-bold text-blue-400">{count}</div>
                <div className="text-sm text-gray-400 truncate">{name}</div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Recent Calls Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">Recent Calls</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Time</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Direction</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Caller</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">IVR</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Queue</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Agent</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentCalls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-300">
                    {formatTime(call.created_time)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        call.direction === 'incoming'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {call.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                    {call.participants[0]?.caller_number || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {call.assigned_ivr_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {call.assigned_call_queue_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {call.assigned_agent_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${getCallStatusColor(
                        call.participants[0]?.call_status || 0
                      )}`}
                    >
                      {getCallStatusLabel(call.participants[0]?.call_status || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {formatDuration(call.bill_duration)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
        <h3 className="text-lg font-medium text-white mb-3">Vapi Integration Status</h3>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-white font-medium">Ready to Connect</p>
              <p className="text-sm text-gray-400">
                Configure Freshcaller IVR to forward calls to Vapi: <code className="bg-gray-700 px-1 rounded">+18453229567</code>
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
            <p className="text-blue-300 text-sm">
              <strong>Setup Instructions:</strong><br />
              1. Go to Freshcaller Admin → Call Workflows → IVR<br />
              2. Add a keypress option (e.g., &quot;Press 5 for AI Assistant&quot;)<br />
              3. Set action: &quot;Forward to external number&quot;<br />
              4. Enter: <code className="bg-blue-800/50 px-1 rounded">+18453229567</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
