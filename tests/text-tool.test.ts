import { describe, it, expect } from 'vitest';
import { StandardTextToolParser } from '../src/types/text-tool.js';

describe('StandardTextToolParser', () => {
  it('strict parse standard format', () => {
    const parser = new StandardTextToolParser({ lenientParsing: false });
    const text =
      "I'll list the files for you.\n" +
      '<tool_call>\n{"name": "shell", "arguments": {"command": "ls -la"}}\n</tool_call>';
    const { remainingText, toolCalls } = parser.parse(text);
    expect(remainingText).toBe("I'll list the files for you.");
    expect(toolCalls[0]?.name).toBe('shell');
    expect(toolCalls[0]?.arguments.command).toBe('ls -la');
  });

  it('L2 prompt contains counterexamples', () => {
    const parser = new StandardTextToolParser({ promptLevel: 'L2', locale: 'en' });
    const prompt = parser.promptInstructions([
      { name: 'shell', description: 'Execute shell commands', parameters: {} },
    ]);
    expect(prompt).toContain('<tool_call>');
    expect(prompt).toContain('WILL BE IGNORED');
    expect(prompt).toContain('shell');
  });
});
