/**
 * Protocol validator using JSON Schema (AJV)
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ProtocolError } from '../errors/index.js';

// V1 Schema embedded for offline validation
const V1_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['id', 'protocol_version'],
  properties: {
    $schema: { type: 'string' },
    id: { type: 'string' },
    name: { type: 'string' },
    protocol_version: { type: 'string' },
    description: { type: 'string' },
    base_url: { type: 'string' },
    auth: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['bearer', 'api_key', 'header'] },
        header_name: { type: 'string' },
        env_var: { type: 'string' },
      },
    },
    streaming: {
      type: 'object',
      properties: {
        decoder: {
          type: 'object',
          properties: {
            format: { type: 'string' },
            strategy: { type: 'string' },
          },
        },
        event_map: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              match: { type: 'string' },
              emit: { type: 'string' },
              extract: { type: 'object' },
            },
          },
        },
      },
    },
    capabilities: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['chat', 'streaming', 'tools', 'vision', 'audio', 'embeddings', 'batch'],
      },
    },
  },
};

const MODELS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['models'],
  properties: {
    $schema: { type: 'string' },
    models: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['provider', 'model_id'],
        properties: {
          provider: { type: 'string' },
          model_id: { type: 'string' },
          context_window: { type: 'number' },
          max_output_tokens: { type: 'number' },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
          },
          pricing: {
            type: 'object',
            properties: {
              input_per_token: { type: 'number' },
              output_per_token: { type: 'number' },
            },
          },
          deprecated: { type: 'boolean' },
          replacement: { type: 'string' },
        },
      },
    },
  },
};

/**
 * Protocol validator class
 */
export class ProtocolValidator {
  private readonly ajv: Ajv;
  private readonly validateProvider: ValidateFunction;
  private readonly validateModels: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);

    // Compile schemas
    this.validateProvider = this.ajv.compile(V1_SCHEMA);
    this.validateModels = this.ajv.compile(MODELS_SCHEMA);
  }

  /**
   * Validate a provider manifest
   * @throws ProtocolError if validation fails
   */
  validateProviderManifest(manifest: unknown): void {
    if (!this.validateProvider(manifest)) {
      const errors = this.validateProvider.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ');
      throw new ProtocolError(`Provider manifest validation failed: ${errors}`);
    }
  }

  /**
   * Validate a models manifest
   * @throws ProtocolError if validation fails
   */
  validateModelsManifest(manifest: unknown): void {
    if (!this.validateModels(manifest)) {
      const errors = this.validateModels.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ');
      throw new ProtocolError(`Models manifest validation failed: ${errors}`);
    }
  }

  /**
   * Check if a provider manifest is valid
   */
  isValidProvider(manifest: unknown): boolean {
    return this.validateProvider(manifest);
  }

  /**
   * Check if a models manifest is valid
   */
  isValidModels(manifest: unknown): boolean {
    return this.validateModels(manifest);
  }
}

/**
 * Default validator instance
 */
let defaultValidator: ProtocolValidator | null = null;

/**
 * Get the default validator instance
 */
export function getValidator(): ProtocolValidator {
  if (!defaultValidator) {
    defaultValidator = new ProtocolValidator();
  }
  return defaultValidator;
}

/**
 * Validate a provider manifest using the default validator
 * @throws ProtocolError if validation fails
 */
export function validateProvider(manifest: unknown): void {
  getValidator().validateProviderManifest(manifest);
}

/**
 * Validate a models manifest using the default validator
 * @throws ProtocolError if validation fails
 */
export function validateModels(manifest: unknown): void {
  getValidator().validateModelsManifest(manifest);
}
