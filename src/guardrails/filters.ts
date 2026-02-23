/**
 * Content filtering implementations.
 */

import { FilterAction, FilterRule } from './config.js';
import { Violation, ViolationType } from './result.js';

/**
 * Trait for content filters
 */
export interface ContentFilter {
  check(content: string): Violation[];
  sanitize(content: string, replacement: string): string;
}

/**
 * Keyword-based content filter
 */
export class KeywordFilter implements ContentFilter {
  private rules: CompiledKeywordRule[] = [];

  static fromRules(rules: FilterRule[]): KeywordFilter {
    const filter = new KeywordFilter();
    for (const rule of rules) {
      if (!rule.isRegex) {
        filter.addRule(rule);
      }
    }
    return filter;
  }

  addKeyword(keyword: string, action: FilterAction): void {
    this.addRule({
      pattern: keyword,
      isRegex: false,
      caseSensitive: false,
      action,
    });
  }

  addRule(rule: FilterRule): void {
    this.rules.push({
      keyword: rule.pattern,
      keywordLower: rule.pattern.toLowerCase(),
      caseSensitive: rule.caseSensitive,
      action: rule.action,
      category: rule.category,
      description: rule.description,
    });
  }

  check(content: string): Violation[] {
    const contentLower = content.toLowerCase();
    const violations: Violation[] = [];

    for (const rule of this.rules) {
      const matched = rule.caseSensitive
        ? content.includes(rule.keyword)
        : contentLower.includes(rule.keywordLower);

      if (matched) {
        violations.push({
          violationType: ViolationType.Keyword,
          pattern: rule.keyword,
          action: rule.action,
          category: rule.category,
          description: rule.description,
          matchedText: rule.keyword,
        });
      }
    }

    return violations;
  }

  sanitize(content: string, replacement: string): string {
    let result = content;

    for (const rule of this.rules) {
      if (rule.action === FilterAction.Sanitize || rule.action === FilterAction.Block) {
        if (rule.caseSensitive) {
          result = result.replaceAll(rule.keyword, replacement);
        }
      }
    }

    return result;
  }
}

interface CompiledKeywordRule {
  keyword: string;
  keywordLower: string;
  caseSensitive: boolean;
  action: FilterAction;
  category?: string;
  description?: string;
}

/**
 * Regex pattern-based content filter
 */
export class PatternFilter implements ContentFilter {
  private rules: CompiledPatternRule[] = [];

  static fromRules(rules: FilterRule[]): PatternFilter {
    const filter = new PatternFilter();
    for (const rule of rules) {
      if (rule.isRegex) {
        filter.addRule(rule);
      }
    }
    return filter;
  }

  addPattern(pattern: string, action: FilterAction): void {
    this.addRule({
      pattern,
      isRegex: true,
      caseSensitive: true,
      action,
    });
  }

  addRule(rule: FilterRule): void {
    this.rules.push({
      patternStr: rule.pattern,
      caseSensitive: rule.caseSensitive,
      action: rule.action,
      category: rule.category,
      description: rule.description,
    });
  }

  check(content: string): Violation[] {
    const violations: Violation[] = [];

    for (const rule of this.rules) {
      try {
        const flags = rule.caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(rule.patternStr, flags);
        const match = regex.exec(content);

        if (match && match[0]) {
          violations.push({
            violationType: ViolationType.Pattern,
            pattern: rule.patternStr,
            action: rule.action,
            category: rule.category,
            description: rule.description,
            matchedText: match[0],
          });
        }
      } catch {
        // Invalid regex - skip
      }
    }

    return violations;
  }

  sanitize(content: string, replacement: string): string {
    let result = content;

    for (const rule of this.rules) {
      if (rule.action === FilterAction.Sanitize || rule.action === FilterAction.Block) {
        try {
          const flags = rule.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(rule.patternStr, flags);
          result = result.replaceAll(regex, replacement);
        } catch {
          // Invalid regex - skip
        }
      }
    }

    return result;
  }
}

interface CompiledPatternRule {
  patternStr: string;
  caseSensitive: boolean;
  action: FilterAction;
  category?: string;
  description?: string;
}
