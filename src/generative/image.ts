/**
 * Experimental image generation via manifest L-Exec (ALT-GEN-002 / ALR-GEN-002).
 *
 * 按 endpoints.image_generation 走统一 HttpTransport；adapter 来自 manifest。
 */

import { AiLibError } from '../errors/index.js';
import type { ProtocolManifest, ProviderManifest } from '../protocol/manifest.js';
import { resolveCredential } from '../transport/credentials.js';
import { HttpTransport } from '../transport/http.js';
import { adapterName, requireGenerativeEndpoint } from './endpoints.js';
import {
  KEY_IMAGE_GENERATION,
  type GeneratedImage,
  type ImageGenerationRequest,
  type ImageGenerationResult,
} from './types.js';

export function openaiImageBody(req: ImageGenerationRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { model: req.model, prompt: req.prompt };
  if (req.size) body.size = req.size;
  if (req.n != null) body.n = req.n;
  if (req.response_format) body.response_format = req.response_format;
  return body;
}

export function dashscopeImageBody(req: ImageGenerationRequest): Record<string, unknown> {
  return {
    model: req.model,
    input: {
      messages: [{ role: 'user', content: [{ text: req.prompt }] }],
    },
  };
}

export function parseOpenaiImage(
  model: string,
  payload: Record<string, unknown>,
): ImageGenerationResult {
  const images: GeneratedImage[] = [];
  const data = payload.data;
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      images.push({
        url: typeof row.url === 'string' ? row.url : undefined,
        b64_json: typeof row.b64_json === 'string' ? row.b64_json : undefined,
        revised_prompt:
          typeof row.revised_prompt === 'string' ? row.revised_prompt : undefined,
      });
    }
  }
  return { model, images };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseDashscopeImage(
  model: string,
  payload: Record<string, unknown>,
): ImageGenerationResult {
  const images: GeneratedImage[] = [];
  const output = asRecord(payload.output);
  if (!output) {
    return { model, images };
  }

  // Multimodal: output.choices[0].message.content[0].image
  const choices = Array.isArray(output.choices) ? output.choices : [];
  const message = asRecord(asRecord(choices[0])?.message);
  const content = Array.isArray(message?.content) ? message.content : [];
  const imageUrl = asRecord(content[0])?.image;
  if (typeof imageUrl === 'string') {
    images.push({ url: imageUrl });
    return { model, images };
  }

  // Fallback: output.results[0].url
  const results = Array.isArray(output.results) ? output.results : [];
  const resultUrl = asRecord(results[0])?.url;
  if (typeof resultUrl === 'string') {
    images.push({ url: resultUrl });
  }
  return { model, images };
}

function transportForModel(manifest: ProviderManifest, model: string): HttpTransport {
  const protocol = { ...manifest, model_id: model } as ProtocolManifest;
  const resolved = resolveCredential(protocol);
  if (!resolved.value) {
    const tried = [...resolved.requiredEnvVars, ...resolved.conventionalEnvVars];
    throw AiLibError.validation(
      `API key required for image_generation (provider=${manifest.id}; tried ${tried.join(', ')})`,
    );
  }
  return new HttpTransport(protocol, { credential: resolved.value });
}

/** Experimental image generation client (capability: `image_generation`). */
export class ImageGenerationClient {
  private readonly transport: HttpTransport;
  private readonly model: string;
  private readonly endpointPath: string;
  private readonly adapter: string;

  constructor(opts: {
    transport: HttpTransport;
    model: string;
    endpointPath: string;
    adapter: string;
  }) {
    this.transport = opts.transport;
    this.model = opts.model;
    this.endpointPath = opts.endpointPath;
    this.adapter = opts.adapter;
  }

  static fromManifest(manifest: ProviderManifest, model: string): ImageGenerationClient {
    const ep = requireGenerativeEndpoint(manifest, model, KEY_IMAGE_GENERATION);
    return new ImageGenerationClient({
      transport: transportForModel(manifest, model),
      model,
      endpointPath: ep.path,
      adapter: adapterName(ep),
    });
  }

  get endpoint_path(): string {
    return this.endpointPath;
  }

  get adapterName(): string {
    return this.adapter;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (request.model !== this.model) {
      throw AiLibError.validation(
        `request model \`${request.model}\` != client model \`${this.model}\``,
      );
    }
    const body =
      this.adapter === 'dashscope'
        ? dashscopeImageBody(request)
        : openaiImageBody(request);
    const response = await this.transport.post(this.endpointPath, body);
    const payload = (await response.json()) as Record<string, unknown>;
    if (this.adapter === 'dashscope') {
      return parseDashscopeImage(this.model, payload);
    }
    return parseOpenaiImage(this.model, payload);
  }
}
