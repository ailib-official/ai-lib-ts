/**
 * Tests for Error types
 */

import { describe, it, expect } from 'vitest';
import {
  AiLibError,
  StandardErrorCode,
  isRetryable,
  isFallbackable,
  classifyHttpStatus,
  Result,
} from '../src/errors/index.ts';

describe('StandardErrorCode', () => {
  it('should have all error codes defined', () => {
    expect(StandardErrorCode.INVALID_REQUEST).toBe('E1001');
    expect(StandardErrorCode.AUTHENTICATION).toBe('E1002');
    expect(StandardErrorCode.RATE_LIMITED).toBe('E2001');
    expect(StandardErrorCode.SERVER_ERROR).toBe('E3001');
    expect(StandardErrorCode.TIMEOUT).toBe('E3003');
    expect(StandardErrorCode.UNKNOWN).toBe('E9999');
  });
});

describe('isRetryable', () => {
  it('should return true for retryable errors', () => {
    expect(isRetryable(StandardErrorCode.RATE_LIMITED)).toBe(true);
    expect(isRetryable(StandardErrorCode.SERVER_ERROR)).toBe(true);
    expect(isRetryable(StandardErrorCode.OVERLOADED)).toBe(true);
    expect(isRetryable(StandardErrorCode.TIMEOUT)).toBe(true);
    expect(isRetryable(StandardErrorCode.CONFLICT)).toBe(true);
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryable(StandardErrorCode.INVALID_REQUEST)).toBe(false);
    expect(isRetryable(StandardErrorCode.AUTHENTICATION)).toBe(false);
    expect(isRetryable(StandardErrorCode.PERMISSION_DENIED)).toBe(false);
    expect(isRetryable(StandardErrorCode.UNKNOWN)).toBe(false);
  });
});

describe('isFallbackable', () => {
  it('should return true for fallbackable errors', () => {
    expect(isFallbackable(StandardErrorCode.AUTHENTICATION)).toBe(true);
    expect(isFallbackable(StandardErrorCode.RATE_LIMITED)).toBe(true);
    expect(isFallbackable(StandardErrorCode.QUOTA_EXHAUSTED)).toBe(true);
    expect(isFallbackable(StandardErrorCode.SERVER_ERROR)).toBe(true);
  });

  it('should return false for non-fallbackable errors', () => {
    expect(isFallbackable(StandardErrorCode.INVALID_REQUEST)).toBe(false);
    expect(isFallbackable(StandardErrorCode.PERMISSION_DENIED)).toBe(false);
    expect(isFallbackable(StandardErrorCode.CONFLICT)).toBe(false);
  });
});

describe('classifyHttpStatus', () => {
  it('should classify HTTP status codes correctly', () => {
    expect(classifyHttpStatus(400)).toBe(StandardErrorCode.INVALID_REQUEST);
    expect(classifyHttpStatus(401)).toBe(StandardErrorCode.AUTHENTICATION);
    expect(classifyHttpStatus(403)).toBe(StandardErrorCode.PERMISSION_DENIED);
    expect(classifyHttpStatus(404)).toBe(StandardErrorCode.NOT_FOUND);
    expect(classifyHttpStatus(413)).toBe(StandardErrorCode.REQUEST_TOO_LARGE);
    expect(classifyHttpStatus(429)).toBe(StandardErrorCode.RATE_LIMITED);
    expect(classifyHttpStatus(500)).toBe(StandardErrorCode.SERVER_ERROR);
    expect(classifyHttpStatus(502)).toBe(StandardErrorCode.OVERLOADED);
    expect(classifyHttpStatus(503)).toBe(StandardErrorCode.OVERLOADED);
    expect(classifyHttpStatus(504)).toBe(StandardErrorCode.TIMEOUT);
    expect(classifyHttpStatus(418)).toBe(StandardErrorCode.UNKNOWN); // I'm a teapot
  });
});

describe('AiLibError', () => {
  it('should create error from HTTP status', () => {
    const error = AiLibError.fromHttpStatus(429, 'Rate limit exceeded');
    expect(error.code).toBe(StandardErrorCode.RATE_LIMITED);
    expect(error.httpStatus).toBe(429);
    expect(error.retryable).toBe(true);
    expect(error.message).toBe('Rate limit exceeded');
  });

  it('should create validation error', () => {
    const error = AiLibError.validation('Invalid message format');
    expect(error.code).toBe(StandardErrorCode.INVALID_REQUEST);
    expect(error.retryable).toBe(false);
  });

  it('should create validation error with context', () => {
    const error = AiLibError.validation('Invalid field', { field: 'email' });
    expect(error.code).toBe(StandardErrorCode.INVALID_REQUEST);
    expect(error.context).toEqual({ field: 'email' });
  });

  it('should create timeout error', () => {
    const error = AiLibError.timeout('Request timed out after 30s');
    expect(error.code).toBe(StandardErrorCode.TIMEOUT);
    expect(error.retryable).toBe(true);
    expect(error.fallbackable).toBe(true);
  });

  it('should create cancelled error', () => {
    const error = AiLibError.cancelled();
    expect(error.code).toBe(StandardErrorCode.CANCELLED);
    expect(error.retryable).toBe(false);
  });

  it('should create unknown error with cause', () => {
    const cause = new Error('Original error');
    const error = AiLibError.unknown('Something went wrong', cause);
    expect(error.code).toBe(StandardErrorCode.UNKNOWN);
    expect(error.cause).toBe(cause);
  });
});

describe('Result', () => {
  it('should create ok result', () => {
    const result = Result.ok(42);
    expect(Result.isOk(result)).toBe(true);
    expect(Result.isErr(result)).toBe(false);
    if (Result.isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it('should create error result', () => {
    const error = AiLibError.validation('Test error');
    const result = Result.err(error);
    expect(Result.isOk(result)).toBe(false);
    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBe(error);
    }
  });
});
