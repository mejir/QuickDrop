'use strict';

const DEFAULT_SETTINGS = {
  openAtLogin: false,
  shortcutMain: 'Alt+Space',
  historyLimit: 50,
};

/**
 * Strips dangerous control characters and enforces a maximum length.
 * Preserves tab (0x09), newline (0x0A), carriage return (0x0D), and all Unicode above 0x7F.
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 100_000);
}

/**
 * Merges partial settings onto a base, validating each field type.
 * Returns a new object; does not mutate inputs.
 */
function mergeSettings(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return { ...base };
  const merged = { ...base };
  if (typeof incoming.openAtLogin === 'boolean') {
    merged.openAtLogin = incoming.openAtLogin;
  }
  if (typeof incoming.shortcutMain === 'string' && incoming.shortcutMain.trim()) {
    merged.shortcutMain = incoming.shortcutMain.trim();
  }
  if (typeof incoming.historyLimit === 'number' && incoming.historyLimit > 0) {
    merged.historyLimit = Math.min(Math.floor(incoming.historyLimit), 10000);
  }
  return merged;
}

module.exports = { sanitizeText, mergeSettings, DEFAULT_SETTINGS };
