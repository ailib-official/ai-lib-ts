/**
 * Guardrails configuration types.
 *
 * Defines filter actions, rules, and builder pattern for GuardrailsConfig.
 */

/**
 * Action to take when a filter rule matches
 */
export enum FilterAction {
  Block,
  Warn,
  Log,
  Sanitize,
  Allow,
}

/**
 * A filter rule definition
 */
export interface FilterRule {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  action: FilterAction;
  category?: string;
  description?: string;
}

/**
 * Configuration for the Guardrails system
 */
export interface GuardrailsConfig {
  filterInput: boolean;
  filterOutput: boolean;
  keywordRules: FilterRule[];
  patternRules: FilterRule[];
  enablePiiDetection: boolean;
  checkPiiInput: boolean;
  checkPiiOutput: boolean;
  sanitizeReplacement: string;
  piiReplacement: string;
  stopOnFirstBlock: boolean;
}

/**
 * Builder for GuardrailsConfig (fluent API)
 */
export class GuardrailsConfigBuilder {
  private config: Partial<GuardrailsConfig> = {
    filterInput: false,
    filterOutput: false,
    keywordRules: [],
    patternRules: [],
    enablePiiDetection: false,
    checkPiiInput: false,
    checkPiiOutput: false,
    sanitizeReplacement: '[FILTERED]',
    piiReplacement: '[PII]',
    stopOnFirstBlock: false,
  };

  filterInput(enable: boolean): this {
    this.config.filterInput = enable;
    return this;
  }

  filterOutput(enable: boolean): this {
    this.config.filterOutput = enable;
    return this;
  }

  addKeywordFilter(keyword: string, action: FilterAction): this {
    this.config.filterInput = true;
    const rules = this.config.keywordRules ?? [];
    rules.push(FilterRule.keyword(keyword, action));
    this.config.keywordRules = rules;
    return this;
  }

  addPatternFilter(pattern: string, action: FilterAction): this {
    this.config.filterInput = true;
    const rules = this.config.patternRules ?? [];
    rules.push(FilterRule.regex(pattern, action));
    this.config.patternRules = rules;
    return this;
  }

  addRule(rule: FilterRule): this {
    this.config.filterInput = true;
    if (rule.isRegex) {
      const rules = this.config.patternRules ?? [];
      rules.push(rule);
      this.config.patternRules = rules;
    } else {
      const rules = this.config.keywordRules ?? [];
      rules.push(rule);
      this.config.keywordRules = rules;
    }
    return this;
  }

  enablePiiDetection(enable: boolean): this {
    this.config.enablePiiDetection = enable;
    this.config.checkPiiInput = enable;
    this.config.checkPiiOutput = enable;
    return this;
  }

  sanitizeReplacement(replacement: string): this {
    this.config.sanitizeReplacement = replacement;
    return this;
  }

  piiReplacement(replacement: string): this {
    this.config.piiReplacement = replacement;
    return this;
  }

  stopOnFirstBlock(stop: boolean): this {
    this.config.stopOnFirstBlock = stop;
    return this;
  }

  build(): GuardrailsConfig {
    return {
      filterInput: this.config.filterInput ?? false,
      filterOutput: this.config.filterOutput ?? false,
      keywordRules: this.config.keywordRules ?? [],
      patternRules: this.config.patternRules ?? [],
      enablePiiDetection: this.config.enablePiiDetection ?? false,
      checkPiiInput: this.config.checkPiiInput ?? false,
      checkPiiOutput: this.config.checkPiiOutput ?? false,
      sanitizeReplacement: this.config.sanitizeReplacement ?? '[FILTERED]',
      piiReplacement: this.config.piiReplacement ?? '[PII]',
      stopOnFirstBlock: this.config.stopOnFirstBlock ?? false,
    };
  }

  static builder(): GuardrailsConfigBuilder {
    return new GuardrailsConfigBuilder();
  }
}

Object.assign(FilterRule, {
  keyword(pattern: string, action: FilterAction): FilterRule {
    return {
      pattern,
      isRegex: false,
      caseSensitive: false,
      action,
    };
  },

  regex(pattern: string, action: FilterAction): FilterRule {
    return {
      pattern,
      isRegex: true,
      caseSensitive: true,
      action,
    };
  },
});

Object.assign(GuardrailsConfig, {
  permissive(): GuardrailsConfig {
    return GuardrailsConfig.builder().build();
  },

  strict(): GuardrailsConfig {
    return GuardrailsConfig.builder()
      .filterInput(true)
      .filterOutput(true)
      .enablePiiDetection(true)
      .stopOnFirstBlock(true)
      .addKeywordFilter('password', FilterAction.Warn)
      .addKeywordFilter('api_key', FilterAction.Warn)
      .addKeywordFilter('secret_key', FilterAction.Warn)
      .addKeywordFilter('access_token', FilterAction.Warn)
      .build();
  },
});
