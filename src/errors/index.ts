/**
 * Standard error codes from AI-Protocol V2
 *
 * All provider errors are classified into 13 standard error codes
 * with unified retry/fallback semantics.
 */

/**
 * Standard error codes enum
 */
export const StandardErrorCode = {
  // Client errors (non-retryable, non-fallback)
  INVALID_REQUEST: 'E1001',
  AUTHENTICATION: 'E1002',
  PERMISSION_DENIED: 'E1003',
  NOT_FOUND: 'E1004',
  REQUEST_TOO_LARGE: 'E1005',

  // Rate/quota errors (retryable or fallback)
  RATE_LIMITED: 'E2001',
  QUOTA_EXHAUSTED: 'E2002',

  // Server errors (retryable, fallback)
  SERVER_ERROR: 'E3001',
  OVERLOADED: 'E3002',
  TIMEOUT: 'E3003',

  // Control flow errors
  CONFLICT: 'E4001',
  CANCELLED: 'E4002',

  // Unknown
  UNKNOWN: 'E9999',
} as const;

export type StandardErrorCodeType = (typeof StandardErrorCode)[keyof typeof StandardErrorCode];

/**
 * Error metadata for classification
 */
export interface ErrorMeta {
  code: StandardErrorCodeType;
  retryable: boolean;
  fallbackable: boolean;
  httpStatus?: number;
  providerCode?: string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Error classification map
 */
const ERROR_CLASSIFICATION: Record<StandardErrorCodeType, { retryable: boolean; fallbackable: boolean }> = {
  [StandardErrorCode.INVALID_REQUEST]: { retryable: false, fallbackable: false },
  [StandardErrorCode.AUTHENTICATION]: { retryable: false, fallbackable: true },
  [StandardErrorCode.PERMISSION_DENIED]: { retryable: false, fallbackable: false },
  [StandardErrorCode.NOT_FOUND]: { retryable: false, fallbackable: false },
  [StandardErrorCode.REQUEST_TOO_LARGE]: { retryable: false, fallbackable: false },
  [StandardErrorCode.RATE_LIMITED]: { retryable: true, fallbackable: true },
  [StandardErrorCode.QUOTA_EXHAUSTED]: { retryable: false, fallbackable: true },
  [StandardErrorCode.SERVER_ERROR]: { retryable: true, fallbackable: true },
  [StandardErrorCode.OVERLOADED]: { retryable: true, fallbackable: true },
  [StandardErrorCode.TIMEOUT]: { retryable: true, fallbackable: true },
  [StandardErrorCode.CONFLICT]: { retryable: true, fallbackable: false },
  [StandardErrorCode.CANCELLED]: { retryable: false, fallbackable: false },
  [StandardErrorCode.UNKNOWN]: { retryable: false, fallbackable: false },
};

/**
 * Check if an error code is retryable
 */
export function isRetryable(code: StandardErrorCodeType): boolean {
  return ERROR_CLASSIFICATION[code]?.retryable ?? false;
}

/**
 * Check if an error code is fallbackable
 */
export function isFallbackable(code: StandardErrorCodeType): boolean {
  return ERROR_CLASSIFICATION[code]?.fallbackable ?? false;
}

/**
 * Classify HTTP status to standard error code
 */
export function classifyHttpStatus(status: number): StandardErrorCodeType {
  if (status === 400) return StandardErrorCode.INVALID_REQUEST;
  if (status === 401) return StandardErrorCode.AUTHENTICATION;
  if (status === 403) return StandardErrorCode.PERMISSION_DENIED;
  if (status === 404) return StandardErrorCode.NOT_FOUND;
  if (status === 413) return StandardErrorCode.REQUEST_TOO_LARGE;
  if (status === 429) return StandardErrorCode.RATE_LIMITED;
  if (status === 409) return StandardErrorCode.CONFLICT;
  if (status === 500) return StandardErrorCode.SERVER_ERROR;
  if (status === 502 || status === 503) return StandardErrorCode.OVERLOADED;
  if (status === 504) return StandardErrorCode.TIMEOUT;
  return StandardErrorCode.UNKNOWN;
}

/**
 * Manifest-aware classifier (gen-005 parity). Consults
 * `error_classification.by_http_status` / `by_error_code` first, then falls back
 * to the numeric HTTP status mapping.
 *
 * Values in the manifest are human-readable types (e.g. `request_too_large`,
 * `rate_limited`); this helper maps them to StandardErrorCode (`E1xxx`/`E2xxx`).
 */
export function classifyHttpStatusWithManifest(
  status: number,
  classification?: {
    by_http_status?: Record<string, string>;
    by_error_code?: Record<string, string>;
  },
  providerCode?: string
): StandardErrorCodeType {
  const mapType = (t?: string): StandardErrorCodeType | undefined => {
    if (!t) return undefined;
    const key = t.toLowerCase();
    switch (key) {
      case 'invalid_request':
        return StandardErrorCode.INVALID_REQUEST;
      case 'authentication':
        return StandardErrorCode.AUTHENTICATION;
      case 'permission_denied':
      case 'forbidden':
        return StandardErrorCode.PERMISSION_DENIED;
      case 'not_found':
        return StandardErrorCode.NOT_FOUND;
      case 'request_too_large':
      case 'context_length_exceeded':
        return StandardErrorCode.REQUEST_TOO_LARGE;
      case 'rate_limited':
      case 'rate_limit_exceeded':
        return StandardErrorCode.RATE_LIMITED;
      case 'quota_exhausted':
        return StandardErrorCode.QUOTA_EXHAUSTED;
      case 'server_error':
        return StandardErrorCode.SERVER_ERROR;
      case 'overloaded':
        return StandardErrorCode.OVERLOADED;
      case 'timeout':
        return StandardErrorCode.TIMEOUT;
      case 'conflict':
        return StandardErrorCode.CONFLICT;
      case 'cancelled':
        return StandardErrorCode.CANCELLED;
      default:
        return undefined;
    }
  };

  if (providerCode && classification?.by_error_code) {
    const mapped = mapType(classification.by_error_code[providerCode]);
    if (mapped) return mapped;
  }
  if (classification?.by_http_status) {
    const mapped = mapType(classification.by_http_status[String(status)]);
    if (mapped) return mapped;
  }
  return classifyHttpStatus(status);
}

/**
 * Base error class for ai-lib-ts
 */
export class AiLibError extends Error {
  readonly code: StandardErrorCodeType;
  readonly retryable: boolean;
  readonly fallbackable: boolean;
  readonly httpStatus?: number;
  readonly providerCode?: string;
  readonly context?: Record<string, unknown>;

  constructor(meta: ErrorMeta, cause?: Error) {
    super(meta.message, { cause });
    this.name = 'AiLibError';
    this.code = meta.code;
    this.retryable = meta.retryable;
    this.fallbackable = meta.fallbackable;
    this.httpStatus = meta.httpStatus;
    this.providerCode = meta.providerCode;
    this.context = meta.context;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AiLibError);
    }
  }

  /**
   * Create from HTTP response
   */
  static fromHttpStatus(status: number, message: string, providerCode?: string): AiLibError {
    const code = classifyHttpStatus(status);
    const meta: ErrorMeta = {
      code,
      retryable: isRetryable(code),
      fallbackable: isFallbackable(code),
      httpStatus: status,
      providerCode,
      message,
    };
    return new AiLibError(meta);
  }

  /**
   * Create a validation error
   */
  static validation(message: string, context?: Record<string, unknown>): AiLibError {
    return new AiLibError({
      code: StandardErrorCode.INVALID_REQUEST,
      retryable: false,
      fallbackable: false,
      message,
      context,
    });
  }

  /**
   * Create a timeout error
   */
  static timeout(message = 'Request timed out'): AiLibError {
    return new AiLibError({
      code: StandardErrorCode.TIMEOUT,
      retryable: true,
      fallbackable: true,
      message,
    });
  }

  /**
   * Create a cancellation error
   */
  static cancelled(message = 'Request was cancelled'): AiLibError {
    return new AiLibError({
      code: StandardErrorCode.CANCELLED,
      retryable: false,
      fallbackable: false,
      message,
    });
  }

  /**
   * Create an unknown error
   */
  static unknown(message: string, cause?: Error): AiLibError {
    return new AiLibError(
      {
        code: StandardErrorCode.UNKNOWN,
        retryable: false,
        fallbackable: false,
        message,
      },
      cause
    );
  }
}

/**
 * Protocol loading error
 */
export class ProtocolError extends Error {
  constructor(message: string, readonly cause?: Error) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = AiLibError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Result = {
  ok<T>(value: T): Result<T> {
    return { ok: true, value };
  },

  err<E extends AiLibError>(error: E): Result<never, E> {
    return { ok: false, error };
  },

  isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
    return result.ok;
  },

  isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return !result.ok;
  },
};
