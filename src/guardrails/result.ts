/**
 * Check result types for guardrails.
 */

import { FilterAction } from './config.js';

/**
 * Violation type
 */
export enum ViolationType {
  Keyword,
  Pattern,
  Pii,
  Custom,
}

/**
 * A detected violation
 */
export interface Violation {
  violationType: ViolationType;
  pattern: string;
  action: FilterAction;
  category?: string;
  description?: string;
  matchedText?: string;
}

export function Violation_isBlocking(v: Violation): boolean {
  return v.action === FilterAction.Block;
}

export function Violation_isWarning(v: Violation): boolean {
  return v.action === FilterAction.Warn;
}

/**
 * Result of a content check
 */
export interface CheckResult {
  violations: readonly Violation[];
  blocked: boolean;
  warned: boolean;
}

export namespace CheckResult {
  export function passed(): CheckResult {
    return { violations: [], blocked: false, warned: false };
  }

  export function fromViolations(violations: Violation[]): CheckResult {
    return {
      violations,
      blocked: violations.some((v) => v.action === FilterAction.Block),
      warned: violations.some((v) => v.action === FilterAction.Warn),
    };
  }

  export function isPassed(r: CheckResult): boolean {
    return !r.blocked && r.violations.length === 0;
  }

  export function isBlocked(r: CheckResult): boolean {
    return r.blocked;
  }

  export function isWarned(r: CheckResult): boolean {
    return r.warned;
  }

  export function hasViolations(r: CheckResult): boolean {
    return r.violations.length > 0;
  }

  export function violations(r: CheckResult): readonly Violation[] {
    return r.violations;
  }

  export function blockingViolations(r: CheckResult): readonly Violation[] {
    return r.violations.filter((v) => v.action === FilterAction.Block);
  }

  export function warningViolations(r: CheckResult): readonly Violation[] {
    return r.violations.filter((v) => v.action === FilterAction.Warn);
  }

  export function merge(base: CheckResult, other: CheckResult): CheckResult {
    return {
      violations: [...base.violations, ...other.violations],
      blocked: base.blocked || other.blocked,
      warned: base.warned || other.warned,
    };
  }

  export function summary(r: CheckResult): string {
    if (isPassed(r)) {
      return 'PASSED';
    } else if (isBlocked(r)) {
      return `BLOCKED: ${r.violations.length} violation(s)`;
    } else if (isWarned(r)) {
      return `WARNING: ${r.violations.length} violation(s)`;
    } else {
      return `INFO: ${r.violations.length} item(s) logged`;
    }
  }
}
