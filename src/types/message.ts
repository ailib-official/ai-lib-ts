/**
 * Message role enum based on AI-Protocol standard_schema
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Image source for multimodal content
 */
export interface ImageSource {
  type: string;
  media_type?: string;
  data: string; // base64 encoded or URL
}

/**
 * Audio source for multimodal content
 */
export interface AudioSource {
  type: string;
  media_type?: string;
  data: string; // base64 encoded or URL
}

/**
 * Content block for multimodal or tool results
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource }
  | { type: 'audio'; source: AudioSource }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown };

/**
 * Message content (can be string or array of content blocks)
 */
export type MessageContent = string | ContentBlock[];

/**
 * Unified message structure based on AI-Protocol standard_schema
 */
export interface Message {
  role: MessageRole;
  content: MessageContent;
}

/**
 * Message factory functions
 */
export const Message = {
  /**
   * Create a system message
   */
  system(text: string): Message {
    return { role: 'system', content: text };
  },

  /**
   * Create a user message
   */
  user(text: string): Message {
    return { role: 'user', content: text };
  },

  /**
   * Create an assistant message
   */
  assistant(text: string): Message {
    return { role: 'assistant', content: text };
  },

  /**
   * Create a message with custom content
   */
  withContent(role: MessageRole, content: MessageContent): Message {
    return { role, content };
  },

  /**
   * Check if message contains an image
   */
  containsImage(message: Message): boolean {
    if (typeof message.content === 'string') return false;
    return message.content.some((block) => block.type === 'image');
  },

  /**
   * Check if message contains audio
   */
  containsAudio(message: Message): boolean {
    if (typeof message.content === 'string') return false;
    return message.content.some((block) => block.type === 'audio');
  },
};

/**
 * Content block factory functions
 */
export const ContentBlock = {
  /**
   * Create a text content block
   */
  text(text: string): ContentBlock {
    return { type: 'text', text };
  },

  /**
   * Create an image content block from base64 data
   */
  imageBase64(data: string, mediaType?: string): ContentBlock {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data,
      },
    };
  },

  /**
   * Create an audio content block from base64 data
   */
  audioBase64(data: string, mediaType?: string): ContentBlock {
    return {
      type: 'audio',
      source: {
        type: 'base64',
        media_type: mediaType,
        data,
      },
    };
  },

  /**
   * Create an image content block from a URL
   */
  imageUrl(url: string): ContentBlock {
    return {
      type: 'image',
      source: {
        type: 'url',
        data: url,
      },
    };
  },
};

/**
 * Guess media type from file extension
 */
export function guessMediaType(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  };
  return ext ? types[ext] : undefined;
}
