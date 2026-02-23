/**
 * Content safety module - provides configurable content filtering and sensitive information detection.
 *
 * This module provides configurable content filtering and safety mechanisms
 * to ensure compliant and safe interactions with AI models.
 *
 * ## Overview
 *
 * Guardrails are essential for production AI applications to:
 * - Prevent sensitive information from being sent to AI providers
 * - Filter inappropriate or policy-violating content in responses
 * - Detect and redact personally identifiable information (PII)
 * - Enforce content policies through configurable rules
 */

export { FilterAction, FilterRule, GuardrailsConfig, GuardrailsConfigBuilder } from './config.js';
export { CheckResult, Violation, ViolationType } from './result.js';
export { KeywordFilter, PatternFilter, type ContentFilter } from './filters.js';
export { PiiDetector } from './pii.js';
export { Guardrails } from './guardrails.js';
export type { MessageContent } from '../types/message.js';
