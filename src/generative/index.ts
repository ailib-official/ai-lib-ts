/**
 * Experimental generative capability surface (ALT-GEN-001/002).
 *
 * 生成式能力：协议门控 + 请求类型 + L-Exec HttpTransport clients。
 */

export {
  KEY_IMAGE_GENERATION,
  KEY_SPEECH_TO_TEXT,
  KEY_TEXT_TO_SPEECH,
  type GeneratedImage,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type SpeechToTextRequest,
  type SpeechToTextResult,
  type TextToSpeechRequest,
  type TextToSpeechResult,
} from './types.js';

export { supportsGenerativeForModel } from '../protocol/manifest.js';

export {
  adapterName,
  requireGenerativeEndpoint,
  resolveGenerativeEndpoint,
  type GenerativeCapabilityKey,
} from './endpoints.js';

export {
  ImageGenerationClient,
  dashscopeImageBody,
  openaiImageBody,
  parseDashscopeImage,
  parseOpenaiImage,
} from './image.js';

export { SpeechToTextClient, TextToSpeechClient } from './audio.js';
