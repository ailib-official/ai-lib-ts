/**
 * PII (Personally Identifiable Information) detection.
 */

import { FilterAction } from './config.js';
import { Violation, ViolationType } from './result.js';

/**
 * PII detector for identifying personally identifiable information
 */
export class PiiDetector {
  private emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private phonePattern = /(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g;
  private creditCardPattern = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g;
  private ssnPattern = /\b[0-9]{3}[-\s]?[0-9]{2}[-\s]?[0-9]{4}\b/g;
  private ipPattern = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?){3}/g;

  check(content: string): Violation[] {
    const violations: Violation[] = [];

    // Check emails
    const emailMatches = content.match(this.emailPattern);
    for (const m of emailMatches ?? []) {
      violations.push({
        violationType: ViolationType.Pii,
        pattern: 'email',
        action: FilterAction.Warn,
        category: 'pii',
        description: 'Email address detected',
        matchedText: m,
      });
    }

    // Check phone numbers
    const phoneMatches = content.match(this.phonePattern);
    for (const m of phoneMatches ?? []) {
      if (m.length >= 10) {
        violations.push({
          violationType: ViolationType.Pii,
          pattern: 'phone',
          action: FilterAction.Warn,
          category: 'pii',
          description: 'Phone number detected',
          matchedText: m,
        });
      }
    }

    // Check credit cards
    const ccMatches = content.match(this.creditCardPattern);
    for (const m of ccMatches ?? []) {
      if (this.isValidCreditCard(m)) {
        violations.push({
          violationType: ViolationType.Pii,
          pattern: 'credit_card',
          action: FilterAction.Block,
          category: 'pii',
          description: 'Credit card number detected',
          matchedText: this.maskCreditCard(m),
        });
      }
    }

    // Check SSN
    const ssnMatches = content.match(this.ssnPattern);
    for (const _m of ssnMatches ?? []) {
      violations.push({
        violationType: ViolationType.Pii,
        pattern: 'ssn',
        action: FilterAction.Block,
        category: 'pii',
        description: 'Social Security Number detected',
        matchedText: 'XXX-XX-XXXX',
      });
    }

    // Check IP addresses
    const ipMatches = content.match(this.ipPattern);
    for (const m of ipMatches ?? []) {
      violations.push({
        violationType: ViolationType.Pii,
        pattern: 'ip_address',
        action: FilterAction.Log,
        category: 'pii',
        description: 'IP address detected',
        matchedText: m,
      });
    }

    return violations;
  }

  sanitize(content: string, replacement: string): string {
    let result = content;

    result = result.replaceAll(this.emailPattern, replacement);
    result = result.replaceAll(this.creditCardPattern, replacement);
    result = result.replaceAll(this.ssnPattern, replacement);

    // For phone numbers, only replace longer matches
    result = result.replace(this.phonePattern, (match) => {
      return match.length >= 10 ? replacement : match;
    });

    return result;
  }

  private isValidCreditCard(number: string): boolean {
    const digits = number.replace(/\D/g, '').split('').map(Number);

    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    let sum = 0;
    let double = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits[i];
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }

    return sum % 10 === 0;
  }

  private maskCreditCard(number: string): string {
    const digits = number.replace(/\D/g, '');
    if (digits.length >= 4) {
      return `****-****-****-${digits.slice(-4)}`;
    }
    return '****';
  }
}
