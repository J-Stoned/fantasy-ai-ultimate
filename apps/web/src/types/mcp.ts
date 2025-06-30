export interface ServerStatus {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  capabilities: string[];
}

export interface WorkflowResult {
  success?: boolean;
  data?: any;
  error?: string;
}

export interface MCPStatusResponse {
  success: boolean;
  servers?: ServerStatus[];
  error?: string;
}

export interface MCPWorkflowResponse {
  success: boolean;
  result?: any;
  error?: string;
}

export interface MCPServerActionResponse {
  success: boolean;
  result?: boolean;
  error?: string;
}

export type WorkflowType = 'player-analysis' | 'dfs-optimization' | 'live-monitoring' | 'trade-analysis';
export type ServerAction = 'start' | 'stop' | 'test';