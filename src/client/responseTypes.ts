/**
 * Unified non-streaming chat response shape (client layer).
 */

export interface ChatResponsePayload {
  content: string;
  /**
   * Aggregated extended thinking / reasoning (ALT-RSN-001).
   * Empty/undefined when absent. Additive — does not change `content` semantics.
   */
  thinking?: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}
