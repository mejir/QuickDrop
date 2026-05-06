import { describe, it, expect } from 'vitest';
import { sanitizeText, mergeSettings, DEFAULT_SETTINGS } from '../src/utils.js';

describe('sanitizeText', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(42)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('passes through normal text unchanged', () => {
    expect(sanitizeText('Hello, World!')).toBe('Hello, World!');
  });

  it('preserves tab, newline, and carriage return', () => {
    expect(sanitizeText('a\tb\nc\r')).toBe('a\tb\nc\r');
  });

  it('strips null bytes', () => {
    expect(sanitizeText('abc\x00def')).toBe('abcdef');
  });

  it('strips control characters except tab/newline/CR', () => {
    expect(sanitizeText('\x01\x02\x03normal\x1F')).toBe('normal');
  });

  it('strips DEL (0x7F)', () => {
    expect(sanitizeText('abc\x7Fdef')).toBe('abcdef');
  });

  it('preserves unicode above 0x7F', () => {
    expect(sanitizeText('こんにちは')).toBe('こんにちは');
    expect(sanitizeText('🎉')).toBe('🎉');
  });

  it('truncates to 100,000 characters', () => {
    const long = 'a'.repeat(200_000);
    expect(sanitizeText(long)).toHaveLength(100_000);
  });
});

describe('mergeSettings', () => {
  it('returns copy of base when incoming is null', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, null);
    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(result).not.toBe(DEFAULT_SETTINGS);
  });

  it('merges valid openAtLogin boolean', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { openAtLogin: true });
    expect(result.openAtLogin).toBe(true);
  });

  it('ignores non-boolean openAtLogin', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { openAtLogin: 'yes' });
    expect(result.openAtLogin).toBe(DEFAULT_SETTINGS.openAtLogin);
  });

  it('merges valid shortcutMain string', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { shortcutMain: 'Ctrl+Alt+N' });
    expect(result.shortcutMain).toBe('Ctrl+Alt+N');
  });

  it('ignores empty shortcutMain', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { shortcutMain: '   ' });
    expect(result.shortcutMain).toBe(DEFAULT_SETTINGS.shortcutMain);
  });

  it('clamps historyLimit to 10000', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { historyLimit: 99999 });
    expect(result.historyLimit).toBe(10000);
  });

  it('ignores non-positive historyLimit', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { historyLimit: -5 });
    expect(result.historyLimit).toBe(DEFAULT_SETTINGS.historyLimit);
  });

  it('ignores zero historyLimit', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { historyLimit: 0 });
    expect(result.historyLimit).toBe(DEFAULT_SETTINGS.historyLimit);
  });

  it('does not mutate base object', () => {
    const base = { ...DEFAULT_SETTINGS };
    mergeSettings(base, { historyLimit: 100 });
    expect(base.historyLimit).toBe(DEFAULT_SETTINGS.historyLimit);
  });

  it('floors decimal historyLimit', () => {
    const result = mergeSettings(DEFAULT_SETTINGS, { historyLimit: 75.9 });
    expect(result.historyLimit).toBe(75);
  });
});
