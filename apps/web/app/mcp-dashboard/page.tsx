'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createComponentLogger } from '../../lib/utils/client-logger';
import type { 
  ServerStatus, 
  WorkflowResult, 
  WorkflowType, 
  ServerAction 
} from '../../types/mcp';

const logger = createComponentLogger('MCPDashboardPage');

export default function MCPDashboardPage() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [workflowResults, setWorkflowResults] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverActionLoading, setServerActionLoading] = useState(false);

  useEffect(() => {
    loadServerStatus();
    const interval = setInterval(loadServerStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadServerStatus = async () => {
    try {
      const response = await fetch('/api/mcp/status');
      const data = await response.json();
      
      if (data.success) {
        setServers(data.servers);
      } else {
        logger.error('Failed to load server status', data.error);
      }
    } catch (error) {
      logger.error('Error loading server status', error);
    }
  };

  const runTestWorkflow = async (workflowType: WorkflowType) => {
    setLoading(true);
    setWorkflowResults(null);
    
    try {
      const response = await fetch('/api/mcp/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowType,
          params: {} // Using default test params
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setWorkflowResults(data.result);
      } else {
        setWorkflowResults({ error: data.error });
      }
    } catch (error) {
      logger.error('Workflow error', error);
      setWorkflowResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const handleServerAction = async (serverId: string, action: ServerAction) => {
    setServerActionLoading(true);
    
    try {
      const response = await fetch(`/api/mcp/servers/${serverId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh server status after action
        await loadServerStatus();
        logger.info(`Server ${action} successful`, { serverId });
      } else {
        logger.error(`Server ${action} failed`, { serverId, error: data.error });
      }
    } catch (error) {
      logger.error(`Error during server ${action}`, error);
    } finally {
      setServerActionLoading(false);
    }
  };

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getCapabilityIcon = useCallback((capability: string) => {
    const icons: Record<string, string> = {
      database: '🗄️',
      sports: '🏆',
      ai: '🤖',
      ml: '🧠',
      fantasy: '🎮',
      dfs: '💰',
      social: '📱',
      news: '📰',
      weather: '🌤️',
      odds: '🎲',
      video: '📹',
      notifications: '🔔',
      tts: '🗣️',
      stt: '👂',
      payments: '💳',
      blockchain: '⛓️',
    };
    return icons[capability] || '📦';
  }, []);

  const groupedServers = useMemo(() => servers.reduce((acc, server) => {
    const category = server.capabilities[0] || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(server);
    return acc;
  }, {} as Record<string, ServerStatus[]>), [servers]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">🎛️ MCP Server Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor and manage 32 MCP servers orchestrating your fantasy platform
        </p>
      </div>

      {/* Server Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-blue-600">{servers.length}</div>
          <div className="text-gray-600 dark:text-gray-400">Total Servers</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-green-600">
            {servers.filter(s => s.status === 'active').length}
          </div>
          <div className="text-gray-600 dark:text-gray-400">Active</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-gray-600">
            {servers.filter(s => s.status === 'inactive').length}
          </div>
          <div className="text-gray-600 dark:text-gray-400">Inactive</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-red-600">
            {servers.filter(s => s.status === 'error').length}
          </div>
          <div className="text-gray-600 dark:text-gray-400">Errors</div>
        </div>
      </div>

      {/* Test Workflows */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">🔧 Test Workflows</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => runTestWorkflow('player-analysis' as WorkflowType)}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
          >
            Player Analysis
          </button>
          <button
            onClick={() => runTestWorkflow('dfs-optimization' as WorkflowType)}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            DFS Optimization
          </button>
          <button
            onClick={() => runTestWorkflow('live-monitoring' as WorkflowType)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Live Monitoring
          </button>
          <button
            onClick={() => runTestWorkflow('trade-analysis' as WorkflowType)}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400"
          >
            Trade Analysis
          </button>
        </div>
        
        {loading && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2">Running workflow...</p>
          </div>
        )}
        
        {workflowResults && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
            <h3 className="font-semibold mb-2">Workflow Results:</h3>
            <pre className="text-sm overflow-auto max-h-64">
              {JSON.stringify(workflowResults, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Object.entries(groupedServers).map(([category, categoryServers]) => (
          <div key={category} className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 capitalize flex items-center gap-2">
              <span className="text-2xl">{getCapabilityIcon(category)}</span>
              {category} Servers
            </h2>
            <div className="space-y-3">
              {categoryServers.map(server => (
                <div
                  key={server.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedServer(server.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{server.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ID: {server.id}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {server.capabilities.map(cap => (
                          <span
                            key={cap}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(
                        server.status
                      )}`}
                    >
                      {server.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Server Detail Modal */}
      {selectedServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">
                {servers.find(s => s.id === selectedServer)?.name}
              </h2>
              <button
                onClick={() => setSelectedServer(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Server ID</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedServer}</p>
              </div>
              
              <div>
                <h3 className="font-semibold">Status</h3>
                <span
                  className={`inline-block px-3 py-1 rounded text-sm font-medium ${getStatusColor(
                    servers.find(s => s.id === selectedServer)?.status || ''
                  )}`}
                >
                  {servers.find(s => s.id === selectedServer)?.status}
                </span>
              </div>
              
              <div>
                <h3 className="font-semibold">Capabilities</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {servers
                    .find(s => s.id === selectedServer)
                    ?.capabilities.map(cap => (
                      <span
                        key={cap}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded text-sm"
                      >
                        {getCapabilityIcon(cap)} {cap}
                      </span>
                    ))}
                </div>
              </div>
              
              <div className="flex gap-4 mt-6">
                <button 
                  onClick={() => handleServerAction(selectedServer, 'start')}
                  disabled={serverActionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {serverActionLoading ? 'Processing...' : 'Start Server'}
                </button>
                <button 
                  onClick={() => handleServerAction(selectedServer, 'stop')}
                  disabled={serverActionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  {serverActionLoading ? 'Processing...' : 'Stop Server'}
                </button>
                <button 
                  onClick={() => handleServerAction(selectedServer, 'test')}
                  disabled={serverActionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {serverActionLoading ? 'Processing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}