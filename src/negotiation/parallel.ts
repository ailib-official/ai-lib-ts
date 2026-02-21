/**
 * Parallel multi-model execution.
 * Runs multiple operations in parallel and returns first success or aggregates results.
 */

export interface ParallelResult<T> {
  /** First successful result, if any */
  value?: T;
  /** Name of the target that succeeded (when using firstSuccess) */
  targetUsed?: string;
  /** All results: target name -> result or error */
  results: Map<string, { success: true; value: T } | { success: false; error: Error }>;
  /** Whether at least one succeeded */
  anySuccess: boolean;
  /** Whether all succeeded */
  allSuccess: boolean;
}

/**
 * Execute multiple operations in parallel, return first success.
 * Fails when all fail.
 */
export async function firstSuccess<T>(
  operations: Array<{ name: string; operation: () => Promise<T> }>
): Promise<{ value: T; targetUsed: string } | { error: Error; results: Map<string, Error> }> {
  const results = await Promise.allSettled(
    operations.map(async (op) => {
      const value = await op.operation();
      return { name: op.name, value };
    })
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const op = operations[i];
    if (r && r.status === 'fulfilled' && op) {
      return { value: r.value.value, targetUsed: op.name };
    }
  }

  const errors = new Map<string, Error>();
  results.forEach((r, i) => {
    const op = operations[i];
    if (r?.status === 'rejected' && op) {
      errors.set(op.name, r.reason instanceof Error ? r.reason : new Error(String(r.reason)));
    }
  });
  const firstError = errors.values().next().value;
  return { error: firstError ?? new Error('All operations failed'), results: errors };
}

/**
 * Execute multiple operations in parallel, aggregate all results
 */
export async function parallelAll<T>(
  operations: Array<{ name: string; operation: () => Promise<T> }>
): Promise<ParallelResult<T>> {
  const settled = await Promise.allSettled(
    operations.map(async (op) => {
      const value = await op.operation();
      return { name: op.name, value };
    })
  );

  const results = new Map<string, { success: true; value: T } | { success: false; error: Error }>();
  let firstSuccess: { value: T; targetUsed: string } | undefined;

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    const op = operations[i]!;
    if (s?.status === 'fulfilled') {
      results.set(op.name, { success: true, value: s.value.value });
      if (!firstSuccess) firstSuccess = { value: s.value.value, targetUsed: op.name };
    } else {
      const err = s?.status === 'rejected'
        ? (s.reason instanceof Error ? s.reason : new Error(String(s.reason)))
        : new Error('Unknown error');
      results.set(op.name, { success: false, error: err });
    }
  }

  const successes = [...results.values()].filter((r) => r.success);
  return {
    value: firstSuccess?.value,
    targetUsed: firstSuccess?.targetUsed,
    results,
    anySuccess: successes.length > 0,
    allSuccess: successes.length === operations.length,
  };
}
