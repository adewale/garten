/**
 * Ambient declarations for tests only.
 *
 * This browser-focused library intentionally omits @types/node (its source
 * must never depend on Node globals), but the doc-sync tests run under
 * Node/vitest and read repository files. Declare the two builtins they use.
 */

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
}

declare module 'node:path' {
  export function resolve(...parts: string[]): string;
}
