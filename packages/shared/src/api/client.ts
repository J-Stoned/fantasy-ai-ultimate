import { ApiResponse, ApiError, PaginatedRequest } from '../types/api';

// 2025 Best Practice: Type-safe config with branded types
export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  cache?: RequestCache;
  revalidate?: number;
  onError?: (error: ApiError) => void | Promise<void>;
  onRequest?: (config: RequestInit) => RequestInit | Promise<RequestInit>;
  onResponse?: <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    retryCondition?: (error: ApiError) => boolean;
  };
}

// 2025 Best Practice: Use const assertions for better type inference
export const DEFAULT_CONFIG = {
  timeout: 30000,
  cache: 'no-cache' as RequestCache,
  revalidate: 60,
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    retryCondition: (error: ApiError) => error.code.startsWith('HTTP_5')
  }
} as const;

// 2025 Best Practice: Modern class with private fields
export class ApiClient {
  #config: Required<ApiClientConfig>;
  #abortControllers = new Map<string, AbortController>();
  #cache = new Map<string, { data: any; timestamp: number }>();

  constructor(config: ApiClientConfig) {
    this.#config = {
      ...DEFAULT_CONFIG,
      ...config,
      retryConfig: {
        ...DEFAULT_CONFIG.retryConfig,
        ...config.retryConfig
      }
    } as Required<ApiClientConfig>;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requestId?: string
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Cancel any existing request with the same ID
    if (requestId) {
      const existingController = this.abortControllers.get(requestId);
      if (existingController) {
        existingController.abort();
      }
    }

    // Create new abort controller
    const abortController = new AbortController();
    if (requestId) {
      this.abortControllers.set(requestId, abortController);
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.config.timeout!);

    try {
      const requestConfig: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
          ...options.headers
        },
        signal: abortController.signal
      };

      // Apply request interceptor
      const finalConfig = this.config.onRequest 
        ? this.config.onRequest(requestConfig) 
        : requestConfig;

      const response = await fetch(url, finalConfig);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error: ApiError = {
          code: `HTTP_${response.status}`,
          message: response.statusText || 'Request failed',
          details: { status: response.status }
        };
        
        if (this.config.onError) {
          this.config.onError(error);
        }

        return { success: false, error };
      }

      const data = await response.json();
      const apiResponse: ApiResponse<T> = {
        success: true,
        data: data.data || data,
        meta: data.meta
      };

      // Apply response interceptor
      return this.config.onResponse 
        ? this.config.onResponse(apiResponse) 
        : apiResponse;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        const apiError: ApiError = {
          code: 'REQUEST_ABORTED',
          message: 'Request was aborted',
          details: { requestId }
        };
        return { success: false, error: apiError };
      }

      const apiError: ApiError = {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { originalError: error }
      };

      if (this.config.onError) {
        this.config.onError(apiError);
      }

      return { success: false, error: apiError };
    } finally {
      if (requestId) {
        this.abortControllers.delete(requestId);
      }
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>, requestId?: string): Promise<ApiResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' }, requestId);
  }

  async post<T>(endpoint: string, body?: any, requestId?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    }, requestId);
  }

  async put<T>(endpoint: string, body?: any, requestId?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    }, requestId);
  }

  async delete<T>(endpoint: string, requestId?: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, requestId);
  }

  async paginated<T>(endpoint: string, request: PaginatedRequest): Promise<ApiResponse<T[]>> {
    const params = {
      page: request.page || 1,
      pageSize: request.pageSize || 20,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
      ...request.filters
    };
    
    return this.get<T[]>(endpoint, params);
  }

  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  cancelAllRequests(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config };
  }
}