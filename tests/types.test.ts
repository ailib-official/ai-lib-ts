/**
 * Tests for Message types
 */

import { describe, it, expect } from 'vitest';
import { Message, ContentBlock, guessMediaType } from '../src/types/index.ts';

describe('Message', () => {
  it('should create a system message', () => {
    const msg = Message.system('You are a helpful assistant.');
    expect(msg.role).toBe('system');
    expect(msg.content).toBe('You are a helpful assistant.');
  });

  it('should create a user message', () => {
    const msg = Message.user('Hello!');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello!');
  });

  it('should create an assistant message', () => {
    const msg = Message.assistant('Hi there!');
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Hi there!');
  });

  it('should create a message with custom content', () => {
    const blocks = [ContentBlock.text('Hello'), ContentBlock.imageUrl('http://example.com/img.png')];
    const msg = Message.withContent('user', blocks);
    expect(msg.role).toBe('user');
    expect(Array.isArray(msg.content)).toBe(true);
  });

  it('should detect image in message', () => {
    const blocks = [ContentBlock.text('Look at this'), ContentBlock.imageUrl('http://example.com/img.png')];
    const msg = Message.withContent('user', blocks);
    expect(Message.containsImage(msg)).toBe(true);
  });

  it('should detect audio in message', () => {
    const blocks = [ContentBlock.audioBase64('base64data', 'audio/mpeg')];
    const msg = Message.withContent('user', blocks);
    expect(Message.containsAudio(msg)).toBe(true);
  });

  it('should return false for text-only messages', () => {
    const msg = Message.user('Hello');
    expect(Message.containsImage(msg)).toBe(false);
    expect(Message.containsAudio(msg)).toBe(false);
  });
});

describe('ContentBlock', () => {
  it('should create a text block', () => {
    const block = ContentBlock.text('Hello');
    expect(block.type).toBe('text');
    expect(block).toHaveProperty('text', 'Hello');
  });

  it('should create an image from base64', () => {
    const block = ContentBlock.imageBase64('base64data', 'image/png');
    expect(block.type).toBe('image');
    if (block.type === 'image') {
      expect(block.source.type).toBe('base64');
      expect(block.source.media_type).toBe('image/png');
    }
  });

  it('should create an image from URL', () => {
    const block = ContentBlock.imageUrl('http://example.com/img.png');
    expect(block.type).toBe('image');
    if (block.type === 'image') {
      expect(block.source.type).toBe('url');
    }
  });

  it('should create audio from base64', () => {
    const block = ContentBlock.audioBase64('base64data', 'audio/mpeg');
    expect(block.type).toBe('audio');
    if (block.type === 'audio') {
      expect(block.source.type).toBe('base64');
    }
  });
});

describe('guessMediaType', () => {
  it('should guess image types', () => {
    expect(guessMediaType('image.png')).toBe('image/png');
    expect(guessMediaType('image.jpg')).toBe('image/jpeg');
    expect(guessMediaType('image.jpeg')).toBe('image/jpeg');
    expect(guessMediaType('image.webp')).toBe('image/webp');
    expect(guessMediaType('image.gif')).toBe('image/gif');
  });

  it('should guess audio types', () => {
    expect(guessMediaType('audio.mp3')).toBe('audio/mpeg');
    expect(guessMediaType('audio.wav')).toBe('audio/wav');
    expect(guessMediaType('audio.ogg')).toBe('audio/ogg');
    expect(guessMediaType('audio.m4a')).toBe('audio/mp4');
  });

  it('should return undefined for unknown types', () => {
    expect(guessMediaType('file.xyz')).toBeUndefined();
    expect(guessMediaType('file')).toBeUndefined();
  });
});
