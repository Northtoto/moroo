// ─── Audio Input Validator ────────────────────────────────────────────────────
// Extracted from src/app/api/tutor/route.ts for testability.
// Pure function — no imports required.

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB — Azure Whisper limit
const MIN_AUDIO_BYTES = 100;              // 100 bytes minimum (basically a header)
const MAX_DURATION_SECONDS = 60 * 10;    // 10 minutes
const MIN_DURATION_SECONDS = 1;

const ALLOWED_TYPES = new Set([
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
  'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac',
  'audio/flac', 'audio/x-m4a',
]);

/**
 * Validate an audio File before sending to Azure Whisper.
 *
 * Checks:
 *   - File size within [100 bytes, 25 MB]
 *   - MIME type on the audio/* allowlist
 *   - Estimated duration within [1 s, 10 min] (based on ~128 kbps average)
 */
export function validateAudioInput(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_AUDIO_BYTES) {
    return {
      valid: false,
      error: `Audio-Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum ist 25 MB.`,
    };
  }

  if (file.size < MIN_AUDIO_BYTES) {
    return { valid: false, error: 'Audio-Datei ist zu klein oder beschädigt.' };
  }

  const fileType = file.type?.toLowerCase() ?? '';
  if (fileType && !fileType.startsWith('audio/') && !ALLOWED_TYPES.has(fileType)) {
    return {
      valid: false,
      error: 'Audio-Format nicht unterstützt. Verwenden Sie MP3, WAV, OGG, FLAC oder WebM.',
    };
  }

  // Rough duration estimate: assume ~128 kbps bitrate average
  const estimatedSeconds = (file.size * 8) / (128 * 1024);

  if (estimatedSeconds > MAX_DURATION_SECONDS) {
    return {
      valid: false,
      error: 'Audio-Datei ist zu lang (geschätzt über 10 Minuten). Bitte eine kürzere Aufnahme versuchen.',
    };
  }

  if (estimatedSeconds < MIN_DURATION_SECONDS && file.size > 500) {
    return {
      valid: false,
      error: 'Audio-Datei enthält zu wenig Audio-Daten. Bitte mindestens 1 Sekunde aufnehmen.',
    };
  }

  return { valid: true };
}
