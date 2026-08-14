/**
 * Experimental generative request/result types (ALT-GEN-001 / PT-GEN-001).
 *
 * 生成式请求类型：与 ALR/ALP-GEN-001 同形；HTTP driver 见 ALT-GEN-002。
 */

/** Capability: `image_generation` */
export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  response_format?: string;
}

export interface GeneratedImage {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface ImageGenerationResult {
  model: string;
  images: GeneratedImage[];
}

/** Capability: `speech_to_text` */
export interface SpeechToTextRequest {
  model: string;
  /** Absolute or relative path / bytes handled by driver later */
  audio: Uint8Array | string;
  language?: string;
  response_format?: string;
}

export interface SpeechToTextResult {
  model: string;
  text: string;
}

/** Capability: `text_to_speech` */
export interface TextToSpeechRequest {
  model: string;
  input: string;
  voice?: string;
  response_format?: string;
}

export interface TextToSpeechResult {
  model: string;
  audio: Uint8Array;
  content_type?: string;
}

export const KEY_IMAGE_GENERATION = 'image_generation';
export const KEY_SPEECH_TO_TEXT = 'speech_to_text';
export const KEY_TEXT_TO_SPEECH = 'text_to_speech';
