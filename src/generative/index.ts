/**
 * Experimental generative capability surface (ALT-GEN-001).
 *
 * 生成式能力：协议门控 + 请求类型；HTTP driver 见 ALT-GEN-002。
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
