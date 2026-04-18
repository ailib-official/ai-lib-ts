/**
 * PT-073: execution-layer-only tests (no merge with default vitest include — strict list).
 * Includes generative capabilities compliance tests for PT-065.
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
    ],
  },
});
