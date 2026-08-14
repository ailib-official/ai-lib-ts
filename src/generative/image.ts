/**
 * Experimental image generation via manifest L-Exec (ALT-GEN-002 / ALR-GEN-002).
 *
 * 按 endpoints.image_generation 走统一 HttpTransport；adapter 来自 manifest。
 */

import { AiLibError } from '../errors/index.js';
import type { ProtocolManifest } from '../protocol/manifest.js';
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

export function parseDashscopeImage(
  model: string,
  payload: Record<string, unknown>,
): ImageGenerationResult {
  const images: GeneratedImage[] = [];
  try {
    const output = payload.output as Record<string, unknown>;
    const choices = output.choices as Array<Record<string, unknown>>;
    const message = choices[0].message as Record<string, unknown>;
    const content = message.content as Array<Record<string, unknown>>;
    const url = content[0].image;
    if (typeof url === 'string') images.push({ url });
  } catch {
    try {
      const output = payload.output as Record<string, unknown>;
      const results = output.results as Array<Record<string, unknown>>;
      const url = results[0].url;
      if (typeof url === 'string') images.push({ url });
    } catch {
      /* empty */
    }
  }
  return { model, images };
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

  static fromManifest(manifest: ProtocolManifest, model: string): ImageGenerationClient {
    const ep = requireGenerativeEndpoint(manifest, model, KEY_IMAGE_GENERATION);
    const resolved = resolveCredential(manifest);
    if (!resolved.value) {
      const tried = [...resolved.requiredEnvVars, ...resolved.conventionalEnvVars];
      throw AiLibError.validation(
        `API key required for image_generation (provider=${manifest.id}; tried ${tried.join(', ')})`,
      );
    }
    const transport = new HttpTransport(manifest, { credential: resolved.value });
    return new ImageGenerationClient({
      transport,
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
