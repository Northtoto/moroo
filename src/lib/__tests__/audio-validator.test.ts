import { describe, it, expect } from 'vitest';
import { validateAudioInput } from '../audio-validator';

describe('validateAudioInput', () => {
  it('rejects files over 25 MB', () => {
    const big = new File(['x'.repeat(26 * 1024 * 1024)], 'big.webm', { type: 'audio/webm' });
    expect(validateAudioInput(big).valid).toBe(false);
  });

  it('rejects non-audio MIME types', () => {
    const exe = new File(['data'], 'evil.exe', { type: 'application/x-msdownload' });
    expect(validateAudioInput(exe).valid).toBe(false);
  });

  it('accepts valid webm audio under 25 MB', () => {
    // ~16 KB — valid size and MIME
    const audio = new File(['x'.repeat(16 * 1024)], 'clip.webm', { type: 'audio/webm' });
    expect(validateAudioInput(audio).valid).toBe(true);
  });
});
