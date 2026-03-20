// ─── Correction Result Parser ─────────────────────────────────────────────────
// Extracted from src/app/api/tutor/route.ts for testability.
// Parses raw GPT JSON responses into typed CorrectionResult objects.

import { logger } from '@/lib/logger';
import type { CorrectionResult } from '@/lib/student-model';

export type { CorrectionResult };

/**
 * Parse raw GPT output into a structured CorrectionResult.
 *
 * Handles:
 *   - Markdown code fences (```json ... ```)
 *   - Confidence clamping to [0, 1]
 *   - Audio-specific pronunciation tips when confidence < 0.7
 *
 * Throws 'INVALID_JSON_RESPONSE' if JSON cannot be extracted.
 * Throws 'GPT_FAILED' for any other parse failure.
 */
export function parseCorrectionResult(
  text: string,
  fallbackOriginal: string,
  isAudio = false,
): CorrectionResult {
  try {
    const stripped = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      logger.error('tutor.parse.invalid_json', undefined, {
        responsePreview: stripped.substring(0, 200),
      });
      // Re-throw with sentinel message so the outer catch can forward it
      const invalidErr = new Error('INVALID_JSON_RESPONSE');
      invalidErr.name = 'INVALID_JSON_RESPONSE';
      throw invalidErr;
    }

    const errorType = (parsed.error_type as string | null);
    const errorCategory = (parsed.error_category as string);
    const rawConfidence =
      typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
    const confidence = Math.max(0, Math.min(1, rawConfidence));

    let explanationDe = (parsed.explanation_de as string) || '';
    if (isAudio && confidence < 0.7) {
      explanationDe +=
        '\n\n💡 **Aussprache-Tipp:** Sprechen Sie langsam und deutlich. Achten Sie auf die Aussprache der Umlaute (ä, ö, ü) und das ß.';
    }

    return {
      original: (parsed.original as string) || fallbackOriginal,
      corrected: (parsed.corrected as string) || fallbackOriginal,
      error_categories: errorType ? [errorCategory || 'Sonstiges'] : [],
      error_type: errorType,
      confidence,
      explanation_de: explanationDe,
      cefr_estimate: (parsed.cefr_estimate as string) || 'B1',
      new_vocabulary:
        (parsed.new_vocabulary as CorrectionResult['new_vocabulary']) || [],
    };
  } catch (err) {
    // Re-surface named sentinel errors (INVALID_JSON_RESPONSE) as-is
    if (err instanceof Error && err.name === 'INVALID_JSON_RESPONSE') throw err;
    logger.error('tutor.parse.failed', err);
    throw new Error('GPT_FAILED');
  }
}
