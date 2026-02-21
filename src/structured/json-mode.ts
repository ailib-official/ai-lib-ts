/**
 * JSON mode support for structured output.
 * Aligned with ai-lib-python structured/json_mode.py
 */

export type JsonMode = 'json' | 'json_schema' | 'off';

export interface JsonModeConfig {
  mode?: JsonMode;
  schema?: Record<string, unknown>;
  schemaName?: string;
  strict?: boolean;
}

/**
 * Create config for simple JSON object mode
 */
export function jsonObjectConfig(): JsonModeConfig {
  return { mode: 'json' };
}

/**
 * Create config from JSON schema
 */
export function jsonSchemaConfig(
  schema: Record<string, unknown>,
  name = 'response',
  strict = true
): JsonModeConfig {
  return { mode: 'json_schema', schema, schemaName: name, strict };
}

/**
 * Build response_format for OpenAI-style API
 */
export function toOpenAIResponseFormat(config: JsonModeConfig): unknown {
  if (config.mode === 'off' || !config.mode) return undefined;
  if (config.mode === 'json') {
    return { type: 'json_object' };
  }
  if (config.mode === 'json_schema' && config.schema) {
    return {
      type: 'json_schema',
      json_schema: {
        name: config.schemaName ?? 'response',
        strict: config.strict ?? true,
        schema: config.schema,
      },
    };
  }
  return undefined;
}
