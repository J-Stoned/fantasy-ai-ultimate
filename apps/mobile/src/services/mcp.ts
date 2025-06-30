/**
 * MARCUS "THE FIXER" RODRIGUEZ - MOBILE MCP ORCHESTRATION
 * 
 * Model Context Protocol for mobile - connect to any data source
 */

import React from 'react';
import { fantasyAPI } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'eventemitter3';

// MCP Server types
export interface MCPServer {
  id: string;
  name: string;
  type: 'postgres' | 'redis' | 'elasticsearch' | 'custom';
  status: 'active' | 'inactive' | 'error';
  capabilities: string[];
  lastPing: Date;
}

// MCP Workflow
export interface MCPWorkflow {
  id: string;
  name: string;
  description: string;
  steps: MCPWorkflowStep[];
  triggers?: MCPTrigger[];
}

export interface MCPWorkflowStep {
  id: string;
  server: string;
  method: string;
  params: any;
  transform?: (data: any) => any;
  errorHandler?: (error: any) => any;
}

export interface MCPTrigger {
  type: 'schedule' | 'event' | 'webhook';
  config: any;
}

export class MCPOrchestrationService extends EventEmitter {
  private static instance: MCPOrchestrationService;
  private servers: Map<string, MCPServer> = new Map();
  private workflows: Map<string, MCPWorkflow> = new Map();
  private activeJobs: Map<string, any> = new Map();

  static getInstance(): MCPOrchestrationService {
    if (!this.instance) {
      this.instance = new MCPOrchestrationService();
    }
    return this.instance;
  }

  async initialize() {
    // Load saved workflows
    await this.loadWorkflows();
    
    // Discover available servers
    await this.discoverServers();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  // Discover and connect to MCP servers
  private async discoverServers() {
    try {
      const servers = await fantasyAPI.mcp.listServers();
      servers.forEach((server: MCPServer) => {
        this.servers.set(server.id, server);
      });
      this.emit('servers-updated', Array.from(this.servers.values()));
    } catch (error) {
      console.error('Failed to discover MCP servers:', error);
    }
  }

  // Health monitoring
  private startHealthMonitoring() {
    setInterval(async () => {
      for (const [id, server] of this.servers) {
        try {
          await fantasyAPI.mcp.callServer(id, 'ping', {});
          server.status = 'active';
          server.lastPing = new Date();
        } catch (error) {
          server.status = 'error';
        }
      }
      this.emit('servers-updated', Array.from(this.servers.values()));
    }, 30000); // Check every 30 seconds
  }

  // Call MCP server method
  async callServer(
    serverId: string,
    method: string,
    params: any
  ): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (server.status !== 'active') {
      throw new Error(`Server ${serverId} is not active`);
    }

    try {
      const result = await fantasyAPI.mcp.callServer(serverId, method, params);
      this.emit('server-call', { serverId, method, params, result });
      return result;
    } catch (error) {
      this.emit('server-error', { serverId, method, params, error });
      throw error;
    }
  }

  // Execute workflow
  async executeWorkflow(
    workflowId: string,
    context: any = {}
  ): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const jobId = `${workflowId}-${Date.now()}`;
    this.activeJobs.set(jobId, { workflow, status: 'running', context });
    this.emit('workflow-started', { jobId, workflow });

    try {
      const results: any[] = [];
      
      for (const step of workflow.steps) {
        try {
          // Execute step
          let result = await this.callServer(
            step.server,
            step.method,
            this.resolveParams(step.params, context, results)
          );

          // Apply transformation if defined
          if (step.transform) {
            result = step.transform(result);
          }

          results.push(result);
          this.emit('workflow-step-completed', { jobId, step, result });
        } catch (error) {
          // Handle step error
          if (step.errorHandler) {
            const handled = step.errorHandler(error);
            results.push(handled);
          } else {
            throw error;
          }
        }
      }

      this.activeJobs.set(jobId, { 
        workflow, 
        status: 'completed', 
        results 
      });
      this.emit('workflow-completed', { jobId, results });
      
      return results;
    } catch (error) {
      this.activeJobs.set(jobId, { 
        workflow, 
        status: 'failed', 
        error 
      });
      this.emit('workflow-failed', { jobId, error });
      throw error;
    }
  }

  // Resolve workflow parameters with context
  private resolveParams(
    params: any,
    context: any,
    previousResults: any[]
  ): any {
    if (typeof params === 'string' && params.startsWith('{{')) {
      // Template syntax: {{context.value}} or {{results[0].value}}
      const path = params.slice(2, -2).trim();
      if (path.startsWith('context.')) {
        return this.getValueByPath(context, path.slice(8));
      } else if (path.startsWith('results[')) {
        const match = path.match(/results\[(\d+)\]\.(.+)/);
        if (match) {
          const index = parseInt(match[1]);
          const subPath = match[2];
          return this.getValueByPath(previousResults[index], subPath);
        }
      }
    } else if (typeof params === 'object') {
      // Recursively resolve object params
      const resolved: any = Array.isArray(params) ? [] : {};
      for (const key in params) {
        resolved[key] = this.resolveParams(
          params[key],
          context,
          previousResults
        );
      }
      return resolved;
    }
    return params;
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  // Create and save workflow
  async createWorkflow(workflow: MCPWorkflow) {
    this.workflows.set(workflow.id, workflow);
    await this.saveWorkflows();
    this.emit('workflow-created', workflow);
  }

  // Built-in workflows
  async runBuiltInWorkflow(
    type: 'player-deep-dive' | 'league-analysis' | 'trade-finder' | 'injury-scan',
    params: any
  ): Promise<any> {
    const workflows: Record<string, MCPWorkflow> = {
      'player-deep-dive': {
        id: 'player-deep-dive',
        name: 'Player Deep Dive',
        description: 'Comprehensive player analysis using multiple data sources',
        steps: [
          {
            id: 'stats',
            server: 'postgres',
            method: 'query',
            params: {
              sql: 'SELECT * FROM player_stats WHERE player_id = {{context.playerId}}'
            }
          },
          {
            id: 'trends',
            server: 'postgres',
            method: 'query',
            params: {
              sql: 'SELECT * FROM player_trends WHERE player_id = {{context.playerId}}'
            }
          },
          {
            id: 'social',
            server: 'custom',
            method: 'analyzeSentiment',
            params: {
              playerId: '{{context.playerId}}'
            }
          }
        ]
      },
      'league-analysis': {
        id: 'league-analysis',
        name: 'League Analysis',
        description: 'Full league competitive analysis',
        steps: [
          {
            id: 'standings',
            server: 'postgres',
            method: 'query',
            params: {
              sql: 'SELECT * FROM league_standings WHERE league_id = {{context.leagueId}}'
            }
          },
          {
            id: 'transactions',
            server: 'postgres',
            method: 'query',
            params: {
              sql: 'SELECT * FROM transactions WHERE league_id = {{context.leagueId}} ORDER BY created_at DESC LIMIT 50'
            }
          }
        ]
      }
    };

    const workflow = workflows[type];
    if (!workflow) {
      throw new Error(`Unknown workflow type: ${type}`);
    }

    return this.executeWorkflow(workflow.id, params);
  }

  // Save/load workflows
  private async saveWorkflows() {
    const workflowData = Array.from(this.workflows.values());
    await AsyncStorage.setItem('mcp_workflows', JSON.stringify(workflowData));
  }

  private async loadWorkflows() {
    try {
      const data = await AsyncStorage.getItem('mcp_workflows');
      if (data) {
        const workflows = JSON.parse(data);
        workflows.forEach((w: MCPWorkflow) => this.workflows.set(w.id, w));
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  }

  // Get server capabilities
  getServerCapabilities(serverId: string): string[] {
    const server = this.servers.get(serverId);
    return server?.capabilities || [];
  }

  // Monitor active jobs
  getActiveJobs(): any[] {
    return Array.from(this.activeJobs.values());
  }

  getJobStatus(jobId: string): any {
    return this.activeJobs.get(jobId);
  }
}

// Export singleton instance
export const mcp = MCPOrchestrationService.getInstance();

// React hook for MCP
export function useMCPWorkflow(workflowId: string) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [result, setResult] = React.useState<any>(null);
  const [progress, setProgress] = React.useState<any[]>([]);

  React.useEffect(() => {
    const handleStepCompleted = ({ step, result }: any) => {
      setProgress(prev => [...prev, { step, result }]);
    };

    mcp.on('workflow-step-completed', handleStepCompleted);
    
    return () => {
      mcp.off('workflow-step-completed', handleStepCompleted);
    };
  }, []);

  const execute = React.useCallback(async (context: any) => {
    setLoading(true);
    setError(null);
    setProgress([]);
    
    try {
      const res = await mcp.executeWorkflow(workflowId, context);
      setResult(res);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  return { execute, loading, error, result, progress };
}

/**
 * THE MARCUS GUARANTEE:
 * 
 * This MCP orchestration provides:
 * - Multi-server coordination
 * - Complex workflow execution
 * - Real-time monitoring
 * - Error handling & recovery
 * - Built-in analysis workflows
 * 
 * Your mobile app can now tap into ANY data source!
 * 
 * - Marcus "The Fixer" Rodriguez
 */