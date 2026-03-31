import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function protocolRoot(): string {
  const envRoot = process.env.AI_PROTOCOL_DIR ?? process.env.AI_PROTOCOL_PATH;
  const candidates = [
    envRoot,
    resolve(process.cwd(), '../ai-protocol'),
    resolve(process.cwd(), '../../ai-protocol'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const root = candidates.find((candidate) => existsSync(candidate));
  if (!root) {
    throw new Error('Unable to locate ai-protocol root');
  }
  return root;
}
