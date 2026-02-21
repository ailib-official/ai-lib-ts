/**
 * Tests for Streaming (CancelHandle)
 */

import { describe, it, expect } from 'vitest';
import { CancelHandle } from '../src/index.ts';

describe('CancelHandle', () => {
  it('should provide signal', () => {
    const handle = new CancelHandle();
    expect(handle.signal).toBeDefined();
    expect(handle.cancelled).toBe(false);
  });

  it('should cancel and set cancelled', () => {
    const handle = new CancelHandle();
    handle.cancel();
    expect(handle.cancelled).toBe(true);
  });

  it('should abort signal when cancelled', () => {
    const handle = new CancelHandle();
    expect(handle.signal.aborted).toBe(false);
    handle.cancel();
    expect(handle.signal.aborted).toBe(true);
  });
});
