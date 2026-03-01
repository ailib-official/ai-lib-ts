# ai-lib-ts v0.4.1 Release Notes

**Release Date**: 2026-02-28

## Summary

This patch release stabilizes guardrails runtime initialization, improves protocol manifest discovery behavior, and normalizes benchmark scaffolding for portable local execution.

## Highlights

- Fixed runtime `FilterRule` initialization failure by using concrete runtime objects
- Improved protocol loader fallback strategy and environment path precedence
- Updated benchmark workflow/config for local output paths and manual CI trigger control

## Validation

- `npm run test -- tests/integration/mock-chat.e2e.test.ts`

