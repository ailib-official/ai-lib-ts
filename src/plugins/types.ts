/**
 * Plugin types
 */

export interface PluginContext {
  model?: string;
  provider?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface Plugin {
  readonly name: string;
  readonly priority?: number;
  readonly enabled?: boolean;
  onInit?(ctx: PluginContext): Promise<void>;
  onShutdown?(ctx: PluginContext): Promise<void>;
  onRequest?(ctx: PluginContext, request: Record<string, unknown>): Promise<Record<string, unknown>>;
  onResponse?(ctx: PluginContext, response: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export type HookType =
  | 'pre_request'
  | 'post_request'
  | 'pre_response'
  | 'post_response'
  | 'stream_start'
  | 'stream_chunk'
  | 'stream_end'
  | 'on_error'
  | 'on_retry'
  | 'client_init'
  | 'client_close';
