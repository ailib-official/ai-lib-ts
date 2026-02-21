/**
 * V2 Manifest types - three-ring structure.
 * Aligned with ai-lib-python protocol/v2/manifest.py
 */

export type ApiStyle = 'openai_compatible' | 'anthropic_messages' | 'gemini_generate' | 'custom';

export interface AuthConfigV2 {
  type?: string;
  token_env?: string;
  header_name?: string;
}

export interface EndpointV2 {
  base_url: string;
  chat?: string;
  models?: string;
  embeddings?: string;
  protocol?: string;
  timeout_ms?: number;
}

export interface ModelDef {
  id: string;
  display_name?: string;
  context_window?: number;
  max_output_tokens?: number;
  pricing?: Record<string, unknown>;
}

export interface StreamingV2 {
  decoder?: string;
  event_map?: Record<string, unknown>;
  accumulator?: Record<string, unknown>;
  candidates?: Record<string, unknown>;
}

export interface McpConfig {
  supported?: boolean;
  protocol_version?: string;
  transport?: string[];
  max_servers?: number;
  timeout_ms?: number;
}

export interface ComputerUseConfig {
  supported?: boolean;
  actions?: string[];
  coordinate_system?: string;
  max_actions_per_turn?: number;
}

export interface MultimodalConfig {
  input_modalities?: string[];
  output_modalities?: string[];
  max_image_size_mb?: number;
  supported_image_formats?: string[];
  audio_formats?: string[];
  video_formats?: string[];
  omni_mode?: boolean;
}

export interface ManifestV2 {
  id: string;
  name?: string;
  protocol_version?: string;
  api_style?: ApiStyle;
  auth?: AuthConfigV2;
  endpoints?: EndpointV2;
  models?: ModelDef[];
  streaming?: StreamingV2;
  multimodal?: MultimodalConfig;
  computer_use?: ComputerUseConfig;
  mcp?: McpConfig;
  [key: string]: unknown;
}
