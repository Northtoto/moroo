# Tutor Response Quality Evaluation Report

**Date:** 2026-03-20
**Dataset:** `data/test-corrections.json` (50 test cases)
**System:** Morodeutsch AI Tutor (Azure OpenAI GPT-4o)

---

## 1. Dataset Distribution

### By CEFR Level
| Level | Count | Percentage |
|-------|-------|------------|
| A1    | 10    | 20%        |
| A2    | 12    | 24%        |
| B1    | 15    | 30%        |
| B2    | 8     | 16%        |
| C1    | 5     | 10%        |

### By Error Category
| Category         | Count | Percentage |
|------------------|-------|------------|
| Wortstellung     | 15    | 30%        |
| Kasus            | 10    | 20%        |
| Konjugation      | 8     | 16%        |
| Präposition      | 5     | 10%        |
| Rechtschreibung  | 3     | 6%         |
| Vokabular        | 3     | 6%         |
| Zeitform         | 2     | 4%         |
| Artikel          | 2     | 4%         |
| Correct (no err) | 1     | 2%         |
| Other            | 1     | 2%         |

---

## 2. Quality Rubric

Each tutor response is evaluated across 5 dimensions (1-5 scale):

| Dimension                  | Weight | Description                                                |
|---------------------------|--------|------------------------------------------------------------|
| Grammatical Correctness   | 30%    | Is the corrected sentence grammatically correct?           |
| Explanation Clarity       | 25%    | Is the explanation clear and in simple German?             |
| CEFR Appropriateness      | 20%    | Is the explanation appropriate for the student's level?    |
| Alternative Quality       | 15%    | Does the alternative sentence demonstrate the rule?        |
| Encouragement             | 10%    | Is the tone encouraging and supportive?                    |

### Scoring Guide
- **5** = Excellent: Perfect execution, pedagogically optimal
- **4** = Good: Minor issues, still effective
- **3** = Adequate: Correct but could be improved
- **2** = Poor: Significant issues affecting learning
- **1** = Failing: Incorrect or unhelpful

---

## 3. Expected Quality Targets

| Metric                        | Target   | Minimum Acceptable |
|-------------------------------|----------|--------------------|
| Grammatical Correctness       | >= 4.5   | >= 4.0             |
| Explanation Clarity           | >= 4.0   | >= 3.5             |
| CEFR Appropriateness          | >= 4.0   | >= 3.5             |
| Alternative Sentence Quality  | >= 3.5   | >= 3.0             |
| Encouragement                 | >= 4.0   | >= 3.5             |
| **Weighted Average**          | **>= 4.2** | **>= 3.8**      |

---

## 4. Known Issues & Areas for Improvement

### 4.1 Current Prompt Gaps

1. **No alternative_sentence field**: Current prompt schema does not request an alternative sentence. This means the tutor cannot show a parallel correct example.
   - **Impact**: Students miss pattern reinforcement
   - **Fix**: Use V2 prompts from `src/lib/prompts/correction-prompts.ts`

2. **explanation_de quality varies by error type**: Complex errors (Konjunktiv, Passiv, Plusquamperfekt) sometimes receive surface-level explanations.
   - **Impact**: B2+ students don't get deep enough grammar explanations
   - **Fix**: Add error-type-specific guidance in system prompt

3. **CEFR-level-adaptive explanations missing**: Same explanation style for A1 and C1 students.
   - **Impact**: A1 students overwhelmed, C1 students underwhelmed
   - **Fix**: Include student CEFR level in prompt context (partially done via student-model.ts)

### 4.2 Error Category Performance (Expected)

| Category         | Expected Score | Risk Area                          |
|------------------|---------------|------------------------------------|
| Artikel          | 4.5           | Low risk - straightforward         |
| Wortstellung     | 4.0           | Medium - complex V2/TeKaMoLo rules |
| Konjugation      | 4.2           | Medium - irregular verbs           |
| Präposition      | 3.8           | Higher risk - idiomatic usage      |
| Kasus            | 4.0           | Medium - declension tables         |
| Rechtschreibung  | 4.5           | Low risk - clear corrections       |
| Vokabular        | 3.5           | Higher risk - nuance needed        |
| Zeitform         | 3.8           | Medium - tense sequence rules      |

### 4.3 Audio-Specific Issues

- Whisper transcription errors may be flagged as student errors
- Current audio prompt partially addresses this but could be more explicit
- Pronunciation feedback is minimal (only tip when confidence < 0.7)

---

## 5. Evaluation Procedure

### Automated Checks (run via test suite)
```bash
npx vitest run tests/tutor/
```

1. **Schema compliance**: All required fields present and valid types
2. **Confidence range**: 0.0 - 1.0, correct sentence = 1.0
3. **CEFR estimation**: Matches expected level +/- 1 level
4. **Error detection**: Correct identification of error category
5. **Non-null explanation**: explanation_de is non-empty for errors

### Manual Review Process

For each of the 50 test cases:
1. Submit the input text to the tutor API
2. Record the full response
3. Score each dimension (1-5)
4. Flag any incorrect corrections
5. Note explanation quality issues

### Running the Evaluation

```bash
# Step 1: Run automated tests
npx vitest run tests/tutor/response-validation.test.ts

# Step 2: Run integration test against live API
# (requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY)
LIVE_API_TEST=1 npx vitest run tests/tutor/text-correction.test.ts

# Step 3: Generate quality scores
npx vitest run tests/tutor/quality-evaluation.test.ts
```

---

## 6. Recommendations

### Immediate (Pre-Launch)
1. **Integrate V2 prompts** from `src/lib/prompts/correction-prompts.ts` to add `alternative_sentence`
2. **Add CEFR-adaptive explanations** — simpler German for A1-A2, technical terms for B2+
3. **Improve audio prompt** — better differentiation of transcription vs. speaking errors

### Short-Term (Week 1)
4. **Run full 50-case evaluation** against live API and compute actual quality scores
5. **A/B test V1 vs V2 prompts** on a subset of users
6. **Add quality monitoring** — log quality scores for random sample of corrections

### Medium-Term (Month 1)
7. **Fine-tune quality rubric** based on user feedback
8. **Add L1-specific test cases** (English, Turkish, Arabic speakers make different errors)
9. **Implement correction confidence calibration** — verify that high-confidence corrections are actually correct

---

## 7. Test Case Examples with Expected Responses

### Example 1: A1 Artikel Error
**Input:** "Ich gehe zu schule"
**Expected Correction:** "Ich gehe zur Schule"
**Expected Explanation:** "Nach 'zu' und 'die' sagt man 'zur'. Das ist eine Zusammenziehung: zu + der = zur. 'Schule' ist weiblich (die Schule), und im Dativ wird 'die' zu 'der'."
**Expected Alternative:** "Ich gehe zur Arbeit." (same zu+die=zur pattern)

### Example 2: B1 Nebensatz
**Input:** "Er hat mir gesagt dass er kommt morgen"
**Expected Correction:** "Er hat mir gesagt, dass er morgen kommt"
**Expected Explanation:** "In einem Nebensatz mit 'dass' steht das Verb am Ende. Hauptsatz: 'Er kommt morgen' → Nebensatz: 'dass er morgen kommt'."
**Expected Alternative:** "Ich weiß, dass er morgen kommt."

### Example 3: Correct Sentence
**Input:** "Ich habe das Buch auf den Tisch gelegt"
**Expected Response:** error_type = null, confidence = 1.0
**Expected Explanation:** "Perfekt! Dein Satz ist grammatisch korrekt. Du hast 'auf + Akkusativ' richtig verwendet, weil es eine Bewegung beschreibt."

---

## 8. Appendix: Full Test Case Index

See `data/test-corrections.json` for the complete dataset with:
- 50 test cases spanning A1-C1
- Expected corrections
- Error categories and types
- Explanation hints for evaluation
