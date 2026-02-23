/**
 * Core feedback types - provides FeedbackSink interface and various feedback events.
 *
 * These types are always available. The full telemetry module (InMemoryFeedbackSink,
 * ConsoleFeedbackSink, etc.) provides additional sinks.
 */

import type { Result } from '../errors/index.js';

/**
 * Timestamp helper - returns Unix timestamp in seconds
 */
function timestamp(): number {
  return Date.now() / 1000;
}

/**
 * Multi-candidate selection feedback
 */
export interface ChoiceSelectionFeedback {
  requestId: string;
  chosenIndex: number;
  rejectedIndices?: number[];
  latencyToSelectMs?: number;
  uiContext?: unknown;
  candidateHashes?: string[];
  timestamp: number;
}

export class ChoiceSelectionFeedbackBuilder {
  private feedback: Partial<ChoiceSelectionFeedback> = { timestamp: timestamp() };

  constructor(requestId: string, chosenIndex: number) {
    this.feedback.requestId = requestId;
    this.feedback.chosenIndex = chosenIndex;
  }

  withRejected(indices: number[]): this {
    this.feedback.rejectedIndices = indices;
    return this;
  }

  withLatency(ms: number): this {
    this.feedback.latencyToSelectMs = ms;
    return this;
  }

  withUiContext(ctx: unknown): this {
    this.feedback.uiContext = ctx;
    return this;
  }

  withCandidateHashes(hashes: string[]): this {
    this.feedback.candidateHashes = hashes;
    return this;
  }

  build(): ChoiceSelectionFeedback {
    return this.feedback as ChoiceSelectionFeedback;
  }
}

/**
 * Rating feedback (e.g., 1-5 stars)
 */
export interface RatingFeedback {
  requestId: string;
  rating: number;
  maxRating: number;
  category?: string;
  comment?: string;
  timestamp: number;
}

export class RatingFeedbackBuilder {
  private feedback: Partial<RatingFeedback> = {
    maxRating: 5,
    timestamp: timestamp(),
  };

  constructor(requestId: string, rating: number) {
    this.feedback.requestId = requestId;
    this.feedback.rating = rating;
  }

  withMaxRating(max: number): this {
    this.feedback.maxRating = max;
    return this;
  }

  withCategory(cat: string): this {
    this.feedback.category = cat;
    return this;
  }

  withComment(comment: string): this {
    this.feedback.comment = comment;
    return this;
  }

  build(): RatingFeedback {
    return this.feedback as RatingFeedback;
  }
}

/**
 * Thumbs up/down feedback
 */
export interface ThumbsFeedback {
  requestId: string;
  isPositive: boolean;
  reason?: string;
  timestamp: number;
}

export class ThumbsFeedbackBuilder {
  private feedback: Partial<ThumbsFeedback> = { timestamp: timestamp() };

  constructor(requestId: string, isPositive: boolean) {
    this.feedback.requestId = requestId;
    this.feedback.isPositive = isPositive;
  }

  thumbsUp(requestId: string): ThumbsFeedback {
    return this.feedback as ThumbsFeedback;
  }

  thumbsDown(requestId: string): ThumbsFeedback {
    return this.feedback as ThumbsFeedback;
  }

  withReason(reason: string): this {
    this.feedback.reason = reason;
    return this;
  }

  build(): ThumbsFeedback {
    return this.feedback as ThumbsFeedback;
  }

  static thumbsUp(requestId: string): ThumbsFeedback {
    return new ThumbsFeedbackBuilder(requestId, true).build();
  }

  static thumbsDown(requestId: string): ThumbsFeedback {
    return new ThumbsFeedbackBuilder(requestId, false).build();
  }
}

/**
 * Free-form text feedback
 */
export interface TextFeedback {
  requestId: string;
  text: string;
  category?: string;
  timestamp: number;
}

export class TextFeedbackBuilder {
  private feedback: Partial<TextFeedback> = { timestamp: timestamp() };

  constructor(requestId: string, text: string) {
    this.feedback.requestId = requestId;
    this.feedback.text = text;
  }

  withCategory(cat: string): this {
    this.feedback.category = cat;
    return this;
  }

  build(): TextFeedback {
    return this.feedback as TextFeedback;
  }
}

/**
 * Correction feedback
 */
export interface CorrectionFeedback {
  requestId: string;
  originalHash: string;
  correctedHash: string;
  editDistance?: number;
  correctionType?: string;
  timestamp: number;
}

export class CorrectionFeedbackBuilder {
  private feedback: Partial<CorrectionFeedback> = { timestamp: timestamp() };

  constructor(requestId: string, original: string, corrected: string) {
    this.feedback.requestId = requestId;
    this.feedback.originalHash = original;
    this.feedback.correctedHash = corrected;
  }

  withEditDistance(distance: number): this {
    this.feedback.editDistance = distance;
    return this;
  }

  withCorrectionType(type: string): this {
    this.feedback.correctionType = type;
    return this;
  }

  build(): CorrectionFeedback {
    return this.feedback as CorrectionFeedback;
  }
}

/**
 * Regeneration feedback
 */
export interface RegenerateFeedback {
  requestId: string;
  regenerationCount: number;
  reason?: string;
  timestamp: number;
}

export class RegenerateFeedbackBuilder {
  private feedback: Partial<RegenerateFeedback> = {
    regenerationCount: 1,
    timestamp: timestamp(),
  };

  constructor(requestId: string) {
    this.feedback.requestId = requestId;
  }

  withCount(count: number): this {
    this.feedback.regenerationCount = count;
    return this;
  }

  withReason(reason: string): this {
    this.feedback.reason = reason;
    return this;
  }

  build(): RegenerateFeedback {
    return this.feedback as RegenerateFeedback;
  }
}

/**
 * Stop generation feedback
 */
export interface StopFeedback {
  requestId: string;
  tokensGenerated?: number;
  reason?: string;
  timestamp: number;
}

export class StopFeedbackBuilder {
  private feedback: Partial<StopFeedback> = { timestamp: timestamp() };

  constructor(requestId: string) {
    this.feedback.requestId = requestId;
  }

  withTokensGenerated(count: number): this {
    this.feedback.tokensGenerated = count;
    return this;
  }

  withReason(reason: string): this {
    this.feedback.reason = reason;
    return this;
  }

  build(): StopFeedback {
    return this.feedback as StopFeedback;
  }
}

/**
 * Typed feedback events (extensible)
 */
export type FeedbackEvent =
  | { type: 'choice_selection'; data: ChoiceSelectionFeedback }
  | { type: 'rating'; data: RatingFeedback }
  | { type: 'thumbs'; data: ThumbsFeedback }
  | { type: 'text'; data: TextFeedback }
  | { type: 'correction'; data: CorrectionFeedback }
  | { type: 'regenerate'; data: RegenerateFeedback }
  | { type: 'stop'; data: StopFeedback };

/**
 * Extract request ID from feedback event
 */
export function getFeedbackRequestId(event: FeedbackEvent): string {
  return event.data.requestId;
}

/**
 * Helpers to create feedback events
 */
export const Feedback = {
  choiceSelection(
    requestId: string,
    chosenIndex: number,
  ): { type: 'choice_selection'; data: ChoiceSelectionFeedback } {
    return {
      type: 'choice_selection',
      data: new ChoiceSelectionFeedbackBuilder(requestId, chosenIndex).build(),
    };
  },

  rating(requestId: string, rating: number): { type: 'rating'; data: RatingFeedback } {
    return {
      type: 'rating',
      data: new RatingFeedbackBuilder(requestId, rating).build(),
    };
  },

  thumbs(requestId: string, isPositive: boolean): { type: 'thumbs'; data: ThumbsFeedback } {
    return {
      type: 'thumbs',
      data: new ThumbsFeedbackBuilder(requestId, isPositive).build(),
    };
  },

  thumbsUp(requestId: string): { type: 'thumbs'; data: ThumbsFeedback } {
    return Feedback.thumbs(requestId, true);
  },

  thumbsDown(requestId: string): { type: 'thumbs'; data: ThumbsFeedback } {
    return Feedback.thumbs(requestId, false);
  },

  text(requestId: string, text: string): { type: 'text'; data: TextFeedback } {
    return {
      type: 'text',
      data: new TextFeedbackBuilder(requestId, text).build(),
    };
  },

  correction(
    requestId: string,
    original: string,
    corrected: string,
  ): { type: 'correction'; data: CorrectionFeedback } {
    return {
      type: 'correction',
      data: new CorrectionFeedbackBuilder(requestId, original, corrected).build(),
    };
  },

  regenerate(requestId: string): { type: 'regenerate'; data: RegenerateFeedback } {
    return {
      type: 'regenerate',
      data: new RegenerateFeedbackBuilder(requestId).build(),
    };
  },

  stop(requestId: string): { type: 'stop'; data: StopFeedback } {
    return {
      type: 'stop',
      data: new StopFeedbackBuilder(requestId).build(),
    };
  },
};

/**
 * Feedback sink interface
 */
export interface FeedbackSink {
  report(event: FeedbackEvent): Promise<Result<void>>;
  reportBatch(events: FeedbackEvent[]): Promise<Result<void>>;
  close(): Promise<Result<void>>;
}

/**
 * No-op feedback sink (default, no collection)
 */
export class NoopFeedbackSink implements FeedbackSink {
  async report(_event: FeedbackEvent): Promise<Result<void>> {
    return { ok: true, value: undefined };
  }

  async reportBatch(_events: FeedbackEvent[]): Promise<Result<void>> {
    return { ok: true, value: undefined };
  }

  async close(): Promise<Result<void>> {
    return { ok: true, value: undefined };
  }
}

/**
 * Returns a no-op feedback sink
 */
export function noopSink(): FeedbackSink {
  return new NoopFeedbackSink();
}
