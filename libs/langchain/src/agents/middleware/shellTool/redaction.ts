/**
 * Represents a match found by a redaction rule.
 */
export interface PIIMatch {
  /**
   * The matched text that was redacted.
   */
  matched: string;
  /**
   * The start position of the match in the original text.
   */
  start: number;
  /**
   * The end position of the match in the original text.
   */
  end: number;
}

/**
 * Error thrown when PII is detected and blocking is enabled.
 */
export class PIIDetectionError extends Error {
  /**
   * The type of PII that was detected.
   */
  readonly piiType: string;
  /**
   * The matches that were found.
   */
  readonly matches: PIIMatch[];

  constructor(piiType: string, matches: PIIMatch[]) {
    super(`Detected ${piiType} in command output`);
    this.name = "PIIDetectionError";
    this.piiType = piiType;
    this.matches = matches;
  }
}

/**
 * Configuration for a redaction rule used by the shell tool middleware.
 * This is simpler than the PII redaction middleware as it only needs one-way
 * redaction (no restoration) with optional blocking capability.
 */
export interface RedactionRule {
  /**
   * The type of PII this rule detects (e.g., "email", "ssn", "credit_card").
   */
  piiType: string;
  /**
   * Regular expression pattern to match.
   */
  pattern: RegExp;
  /**
   * Replacement string (default: "[REDACTED]").
   */
  replacement?: string;
  /**
   * Whether to block execution if this PII is detected (default: false).
   * When true, throws {@link PIIDetectionError} if matches are found.
   */
  blockOnMatch?: boolean;
}

/**
 * Resolved redaction rule with all defaults applied.
 */
export class ResolvedRedactionRule {
  readonly piiType: string;
  readonly pattern: RegExp;
  readonly replacement: string;
  readonly blockOnMatch: boolean;

  constructor(rule: RedactionRule) {
    this.piiType = rule.piiType;
    this.pattern = rule.pattern;
    this.replacement = rule.replacement ?? "[REDACTED]";
    this.blockOnMatch = rule.blockOnMatch ?? false;
  }

  /**
   * Applies the redaction rule to the given content.
   *
   * @param content - The content to redact
   * @returns A tuple of [redactedContent, matches]
   */
  apply(content: string): [string, PIIMatch[]] {
    const matches: PIIMatch[] = [];
    let redacted = content;

    // Find all matches
    const regex = new RegExp(this.pattern.source, `${this.pattern.flags}g`);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      matches.push({
        matched: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // If blocking is enabled and matches were found, throw an error
    if (this.blockOnMatch && matches.length > 0) {
      throw new PIIDetectionError(this.piiType, matches);
    }

    // Apply redactions in reverse order to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      redacted =
        redacted.slice(0, m.start) + this.replacement + redacted.slice(m.end);
    }

    return [redacted, matches];
  }
}

/**
 * Helper functions to create common redaction rules for shell tool output.
 */
export const CommonRedactionRules = {
  /**
   * Detects email addresses.
   */
  email: (): RedactionRule => ({
    piiType: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  }),

  /**
   * Detects US Social Security Numbers (SSN).
   */
  ssn: (): RedactionRule => ({
    piiType: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  }),

  /**
   * Detects credit card numbers (basic pattern).
   */
  creditCard: (): RedactionRule => ({
    piiType: "credit_card",
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  }),

  /**
   * Detects API keys (common patterns).
   */
  apiKey: (): RedactionRule => ({
    piiType: "api_key",
    pattern: /\b(?:sk|pk|AKIA|AIza|ghp|gho)_[A-Za-z0-9]{20,}\b/g,
  }),
};
