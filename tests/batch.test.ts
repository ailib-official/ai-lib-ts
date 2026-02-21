import { describe, it, expect } from 'vitest';
import {
  BatchExecutor,
  batchExecute,
  BatchCollector,
  createBatchConfig,
  batchConfigForEmbeddings,
  batchConfigForChat,
} from '../src/index.js';

describe('BatchExecutor', () => {
  it('executes items concurrently', async () => {
    const results: number[] = [];
    const op = async (x: number) => {
      await new Promise((r) => setTimeout(r, 10));
      results.push(x);
      return x * 2;
    };

    const executor = new BatchExecutor<number, number>(op, {
      maxConcurrent: 3,
    });
    const result = await executor.execute([1, 2, 3, 4, 5]);

    expect(result.results).toEqual([2, 4, 6, 8, 10]);
    expect(result.errors.every((e) => e === null)).toBe(true);
    expect(result.successfulCount).toBe(5);
    expect(result.failedCount).toBe(0);
    expect(result.allSuccessful).toBe(true);
    expect(result.totalTimeMs).toBeGreaterThan(0);
  });

  it('captures errors when failFast is false', async () => {
    const op = async (x: number) => {
      if (x === 2) throw new Error('fail');
      return x;
    };

    const result = await batchExecute([1, 2, 3], op);
    expect(result.results[0]).toBe(1);
    expect(result.results[1]).toBe(null);
    expect(result.results[2]).toBe(3);
    expect(result.errors[1]).toBeInstanceOf(Error);
    expect(result.successfulCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.allSuccessful).toBe(false);
  });

  it('executeWithProgress calls callback', async () => {
    const progress: [number, number][] = [];
    const op = async (x: number) => x;
    const executor = new BatchExecutor<number, number>(op);

    await executor.executeWithProgress([1, 2, 3], (done, total) => {
      progress.push([done, total]);
    });

    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(progress.some(([d, t]) => d === t)).toBe(true);
  });
});

describe('BatchCollector', () => {
  it('batches and executes', async () => {
    const executed: number[][] = [];
    const collector = new BatchCollector<number, number>(
      { maxBatchSize: 3, maxWaitMs: 100 },
      async (items) => {
        executed.push([...items]);
        return items.map((x) => x * 10);
      }
    );

    const [r1, r2, r3] = await Promise.all([
      collector.add(1),
      collector.add(2),
      collector.add(3),
    ]);

    expect(r1).toBe(10);
    expect(r2).toBe(20);
    expect(r3).toBe(30);
    expect(executed).toHaveLength(1);
    expect(executed[0]).toEqual([1, 2, 3]);
  });

  it('createBatchConfig returns defaults', () => {
    const cfg = createBatchConfig();
    expect(cfg.maxBatchSize).toBe(10);
    expect(cfg.maxWaitMs).toBe(100);
  });

  it('batchConfigForEmbeddings has larger batch', () => {
    const cfg = batchConfigForEmbeddings();
    expect(cfg.maxBatchSize).toBe(100);
    expect(cfg.maxWaitMs).toBe(50);
  });

  it('batchConfigForChat has smaller batch', () => {
    const cfg = batchConfigForChat();
    expect(cfg.maxBatchSize).toBe(5);
    expect(cfg.maxWaitMs).toBe(10);
  });
});
