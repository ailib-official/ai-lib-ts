import { describe, it, expect } from 'vitest';
import {
  StandardTextToolParser,
  parseHybridToolCalls,
} from '../src/types/text-tool.js';
import type { TextParsedToolCall } from '../src/types/text-tool.js';

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

  it('lenient DeepSeek DSML dialect', () => {
    const parser = new StandardTextToolParser({ lenientParsing: true });
    const text =
      '我来检查 piubt 服务器上 pifan 服务的概况。\n\n' +
      '<｜｜DSML｜｜tool_calls>\n' +
      '<｜｜DSML｜｜invoke name="shell">\n' +
      '<｜｜DSML｜｜parameter name="command" string="true">' +
      'ssh piubt "systemctl status pifan" 2>&1</｜｜DSML｜｜parameter>\n' +
      '</｜｜DSML｜｜invoke>\n' +
      '</｜｜DSML｜｜tool_calls>';
    const { remainingText, toolCalls } = parser.parse(text);
    expect(remainingText).toBe('我来检查 piubt 服务器上 pifan 服务的概况。');
    expect(toolCalls[0]?.name).toBe('shell');
    expect(toolCalls[0]?.arguments.command).toBe('ssh piubt "systemctl status pifan" 2>&1');
  });

  it('hybrid falls back to text when native empty', () => {
    const parser = new StandardTextToolParser({ lenientParsing: true });
    const { remainingText, toolCalls } = parseHybridToolCalls(
      parser,
      '<shell><command>ls</command></shell>',
      [],
    );
    expect(remainingText).toBe('');
    expect(toolCalls[0]?.name).toBe('shell');
  });

  it('hybrid prefers native calls', () => {
    const parser = new StandardTextToolParser({ lenientParsing: true });
    const native: TextParsedToolCall[] = [
      { id: 'call_abc', name: 'shell', arguments: { command: 'ls -la' } },
    ];
    const text = '<shell><command>ignored</command></shell>';
    const { remainingText, toolCalls } = parseHybridToolCalls(parser, text, native);
    expect(remainingText.trim()).toBe(text.trim());
    expect(toolCalls[0]?.arguments.command).toBe('ls -la');
  });
});
