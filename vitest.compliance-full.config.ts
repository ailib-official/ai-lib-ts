/**
 * PT-073b: full compliance vitest matrix (includes policy-heavy 06-resilience).
 * E-only subset remains vitest.core.config.ts / `npm run test:core`.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: [
      'tests/compliance-matrix.test.ts',
      'tests/advanced-capabilities.compliance.test.ts',
      'tests/protocol-loading.compliance.test.ts',
      'tests/generative.compliance.test.ts',
      'tests/credential-chain.compliance.test.ts',
      'tests/text-tool-compliance.test.ts',
      'tests/content-block-encoding.compliance.test.ts',
      'tests/retry-policy.compliance.test.ts',
    ],
  },
});
