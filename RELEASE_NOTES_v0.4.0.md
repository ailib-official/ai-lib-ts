# ai-lib-ts v0.4.0 Release Notes

**Release Date**: 2026-02-21

## Summary

v0.4.0 completes iteration 10 of the Python/Rust runtime alignment plan. New modules include PreflightChecker (unified request gating), BatchExecutor/BatchCollector (batch processing), and Pipeline.fromManifest (manifest-driven pipeline construction). README and README_CN are now aligned with ai-lib-python structure.

## New Modules

### PreflightChecker
- Unified preflight validation before request execution
- Integrates circuit breaker, rate limiter, and backpressure checks
- Configurable: checkCircuitBreaker, checkRateLimiter, checkBackpressure, failFast, timeoutMs
- PreflightResult with release() callback for permit cleanup
- onSuccess() / onFailure() for circuit breaker state updates

### BatchExecutor
- Parallel execution with configurable maxConcurrent
- execute(items) and executeWithProgress(items, onProgress)
- BatchResult: results, errors, totalTimeMs, successfulCount, failedCount, allSuccessful
- batchExecute() convenience function
- failFast option to stop on first error

### BatchCollector
- Request grouping until batch size or time limit
- BatchConfig: maxBatchSize, maxWaitMs, groupBy
- batchConfigForEmbeddings(), batchConfigForChat() presets
- add(data) returns Promise<R>, flush(), stop()

### Pipeline.fromManifest
- Create pipeline from ProtocolManifest
- Infers decoder/event mapper from provider id (openai vs anthropic)

## Breaking Changes

None. All additions are additive.

## Migration from v0.3.0

No migration required. New modules are opt-in.

## Test Coverage

- 127 tests passing
- New: preflight.test.ts, batch.test.ts
- Pipeline.fromManifest tests in protocol-v2.test.ts

## Documentation

- README: Restructured to align with ai-lib-python (Design Philosophy, Features, V2 Protocol, Usage Examples, API Reference, Architecture, Project Structure)
- README_CN.md: New Chinese README

## Related

- [align_2_python_runtime.md](.work/align_2_python_runtime.md)
- [iteration_10_plan.md](.work/iteration_10_plan.md)
