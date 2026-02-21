/**
 * Batch processing module.
 * Aligns with ai-lib-python batch/
 */

export {
  BatchExecutor,
  batchExecute,
  type BatchResult,
  type BatchExecutorOptions,
} from './executor.js';

export {
  BatchCollector,
  createBatchConfig,
  batchConfigForEmbeddings,
  batchConfigForChat,
  defaultBatchConfig,
  type BatchConfig,
} from './collector.js';
