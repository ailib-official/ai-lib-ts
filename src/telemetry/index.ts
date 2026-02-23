/**
 * Telemetry module - feedback collection and observability.
 *
 * This module provides optional, application-controlled telemetry and feedback
 * collection capabilities. Privacy is paramount - the runtime MUST NOT force
 * telemetry collection.
 *
 * ## Overview
 *
 * The feedback system enables:
 * - Collection of user preferences (thumbs up/down, ratings)
 * - Tracking of choice selections in multi-candidate responses
 * - Recording of corrections and regeneration requests
 * - Custom feedback integration with external systems
 *
 * ## Components
 *
 * - **FeedbackEvent**: Typed feedback event types
 * - **FeedbackSink**: Interface for feedback destinations
 * - **InMemoryFeedbackSink**: In-memory sink for testing
 * - **ConsoleFeedbackSink**: Console logging sink for debugging
 * - **CompositeFeedbackSink**: Multi-destination composite sink
 * - **Global sink management**: get/set global feedback sink
 */

// Core types (always available)
export * from './types.js';

// Telemetry sinks
export * from './sinks.js';
