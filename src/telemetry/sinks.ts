/**
 * Telemetry sink implementations for feedback collection.
 *
 * Provides various feedback sinks:
 * - InMemoryFeedbackSink: In-memory storage for testing (with max capacity)
 * - ConsoleFeedbackSink: Console logging for debugging
 * - CompositeFeedbackSink: Multi-destination composite sink
 * - Global sink management: get/set global feedback sink
 */

import type { Result } from '../errors/index.js';
import type {
  FeedbackEvent,
  FeedbackSink,
} from './types.js';
import { noopSink } from './types.js';

/**
 * In-memory feedback sink for testing.
 *
 * Stores up to max_events feedback events, dropping oldest when capacity exceeded.
 */
export class InMemoryFeedbackSink implements FeedbackSink {
  private events: FeedbackEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
  }

  async report(event: FeedbackEvent): Promise<Result<void>> {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    return { ok: true, value: undefined };
  }

  async reportBatch(events: FeedbackEvent[]): Promise<Result<void>> {
    for (const event of events) {
      await this.report(event);
    }
    return { ok: true, value: undefined };
  }

  async close(): Promise<Result<void>> {
    this.events = [];
    return { ok: true, value: undefined };
  }

  /**
   * Get all stored events
   */
  getEvents(): FeedbackEvent[] {
    return [...this.events];
  }

  /**
   * Get events by request ID
   */
  getEventsByRequest(requestId: string): FeedbackEvent[] {
    return this.events.filter((e) => e.data.requestId === requestId);
  }

  /**
   * Clear all stored events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get number of stored events
   */
  length(): number {
    return this.events.length;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.events.length === 0;
  }
}

/**
 * Console feedback sink for debugging.
 *
 * Logs all feedback events to console with optional prefix.
 */
export class ConsoleFeedbackSink implements FeedbackSink {
  private readonly prefix: string;

  constructor(prefix: string = '[Feedback]') {
    this.prefix = prefix;
  }

  async report(event: FeedbackEvent): Promise<Result<void>> {
    console.log(this.prefix, JSON.stringify(event));
    return { ok: true, value: undefined };
  }

  async reportBatch(events: FeedbackEvent[]): Promise<Result<void>> {
    for (const event of events) {
      await this.report(event);
    }
    return { ok: true, value: undefined };
  }

  async close(): Promise<Result<void>> {
    console.log(this.prefix, 'Closed');
    return { ok: true, value: undefined };
  }
}

/**
 * Composite feedback sink for multiple destinations.
 *
 * Sends each feedback event to all registered sinks sequentially.
 */
export class CompositeFeedbackSink implements FeedbackSink {
  private readonly sinks: FeedbackSink[] = [];

  /**
   * Add a sink to the composite
   */
  addSink(sink: FeedbackSink): this {
    this.sinks.push(sink);
    return this;
  }

  async report(event: FeedbackEvent): Promise<Result<void>> {
    for (const sink of this.sinks) {
      await sink.report(event);
    }
    return { ok: true, value: undefined };
  }

  async reportBatch(events: FeedbackEvent[]): Promise<Result<void>> {
    for (const sink of this.sinks) {
      await sink.reportBatch(events);
    }
    return { ok: true, value: undefined };
  }

  async close(): Promise<Result<void>> {
    for (const sink of this.sinks) {
      await sink.close();
    }
    return { ok: true, value: undefined };
  }
}

/**
 * Global feedback sink (module-level singleton).
 *
 * Default: NoopFeedbackSink (no collection).
 * Can be replaced with custom sink via setGlobalSink().
 */
let globalSink: FeedbackSink = noopSink();

/**
 * Get the globally configured feedback sink.
 */
export function getGlobalSink(): FeedbackSink {
  return globalSink;
}

/**
 * Set the global feedback sink.
 */
export function setGlobalSink(sink: FeedbackSink): void {
  globalSink = sink;
}

/**
 * Report feedback to the global sink.
 */
export async function reportFeedback(event: FeedbackEvent): Promise<Result<void>> {
  return globalSink.report(event);
}

/**
 * Report feedback batch to the global sink.
 */
export async function reportFeedbackBatch(
  events: FeedbackEvent[],
): Promise<Result<void>> {
  return globalSink.reportBatch(events);
}
