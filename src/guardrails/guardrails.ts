/**
 * Main guardrails controller for content filtering.
 */

import { FilterAction, GuardrailsConfig } from './config.js';
import { KeywordFilter, PatternFilter } from './filters.js';
import { PiiDetector } from './pii.js';
import { CheckResult } from './result.js';
import type { Message as MessageType } from '../types/message.js';

/**
 * Extract text content from a message
 */
function extractTextContent(message: MessageType): string {
  const content = message.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textBlocks = content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text);
    return textBlocks.join(' ');
  }

  return '';
}

/**
 * Main guardrails controller for content filtering
 */
export class Guardrails {
  private config: GuardrailsConfig;
  private keywordFilter: KeywordFilter;
  private patternFilter: PatternFilter;
  private piiDetector?: PiiDetector;

  constructor(config: GuardrailsConfig) {
    this.config = config;
    this.keywordFilter = KeywordFilter.fromRules(config.keywordRules);
    this.patternFilter = PatternFilter.fromRules(config.patternRules);
    this.piiDetector = config.enablePiiDetection ? new PiiDetector() : undefined;
  }

  /**
   * Create a Guardrails instance with permissive configuration
   */
  static permissive(): Guardrails {
    return new Guardrails(GuardrailsConfig.permissive());
  }

  /**
   * Create a Guardrails instance with strict safety defaults
   */
  static strict(): Guardrails {
    return new Guardrails(GuardrailsConfig.strict());
  }

  /**
   * Check input content before sending to the model
   */
  checkInput(content: string): CheckResult {
    return this.checkContent(content, true);
  }

  /**
   * Check output content received from the model
   */
  checkOutput(content: string): CheckResult {
    return this.checkContent(content, false);
  }

  /**
   * Check a message (extracts text content and checks it)
   */
  checkMessage(message: MessageType): CheckResult {
    const content = extractTextContent(message);
    return this.checkContent(content, true);
  }

  /**
   * Check multiple messages
   */
  checkMessages(messages: MessageType[]): CheckResult {
    let combinedResult = CheckResult.passed();

    for (const message of messages) {
      const result = this.checkMessage(message);
      combinedResult = CheckResult.merge(combinedResult, result);

      if (combinedResult.blocked && this.config.stopOnFirstBlock) {
        break;
      }
    }

    return combinedResult;
  }

  /**
   * Internal content checking logic
   */
  private checkContent(content: string, isInput: boolean): CheckResult {
    const violations: any[] = [];

    if ((isInput && this.config.filterInput) || (!isInput && this.config.filterOutput)) {
      violations.push(...this.keywordFilter.check(content));
      violations.push(...this.patternFilter.check(content));
    }

    if (this.piiDetector) {
      if ((isInput && this.config.checkPiiInput) || (!isInput && this.config.checkPiiOutput)) {
        violations.push(...this.piiDetector.check(content));
      }
    }

    return CheckResult.fromViolations(violations);
  }

  /**
   * Sanitize content by removing or replacing detected violations
   */
  sanitize(content: string): string {
    let sanitized = content;

    sanitized = this.keywordFilter.sanitize(sanitized, this.config.sanitizeReplacement);
    sanitized = this.patternFilter.sanitize(sanitized, this.config.sanitizeReplacement);

    if (this.piiDetector) {
      sanitized = this.piiDetector.sanitize(sanitized, this.config.piiReplacement);
    }

    return sanitized;
  }

  /**
   * Get the current configuration
   */
  getConfig(): GuardrailsConfig {
    return this.config;
  }
}
