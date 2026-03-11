# Architecture Gaps: Current vs Required for OpenRouter + Azure

## CURRENT ARCHITECTURE (Azure Only)

```
┌─────────────────────────────────────────┐
│         Student Web App                  │
│      (Next.js + TypeScript)              │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      API Routes (/api/tutor)             │
│  - callN8nWorkflow(workflow, data)       │
│  - No provider detection                 │
│  - No fallback logic                     │
└────────────┬────────────────────────────┘
             │
             ▼ (hardcoded workflow name)
┌─────────────────────────────────────────┐
│        n8n Workflows (Local)             │
│  • text-correction.json                  │
│  • audio-correction.json                 │
│  • ocr-correction.json                   │
│                                          │
│  (All hardcoded to use Azure)            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│     AZURE OPENAI ONLY                    │
│  - GPT-5.2 Deployment                    │
│  - Whisper Deployment                    │
│  - Single org credentials                │
│  - No fallback                           │
└─────────────────────────────────────────┘

❌ GAPS:
  • No OpenRouter support
  • No provider switching
  • No student-specific credentials
  • No fallback mechanism
  • No cost tracking per provider
```

---

## REQUIRED ARCHITECTURE (Azure + OpenRouter)

```
┌─────────────────────────────────────────┐
│         Student Web App                  │
│      (Next.js + TypeScript)              │
│  + Settings page (provider selection)    │
│  + Usage tracking UI                     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      API Routes (/api/tutor)             │
│  ✅ determineProvider(user) function     │
│  ✅ getPreferredProvider() from profile  │
│  ✅ fallback logic (azure → openrouter)  │
│  ✅ cost tracking logging                │
│  ✅ rate limit checking                  │
└────────────┬────────────────────────────┘
             │
             ├─────────────────┬───────────────┐
             │                 │               │
             ▼ (provider)      ▼ (provider)    ▼ (provider)
┌─────────────────────────┐ ┌────────────────────┐
│  n8n Azure Workflows    │ │ n8n OpenRouter     │
│  • text-...azure        │ │ • text-...openrouter
│  • audio-...azure       │ │ • audio-...openrouter
│  • ocr-...azure         │ │ • ocr-...openrouter
└────────┬────────────────┘ └──────┬─────────────┘
         │                         │
         ▼                         ▼
    ┌─────────────┐        ┌──────────────────┐
    │   AZURE     │        │   OPENROUTER     │
    │  • GPT-5.2  │        │  • GPT-4o-mini   │
    │  • Whisper  │        │  • Whisper-1     │
    │  • Per-org  │        │  • Per-student   │
    │   creds     │        │   API keys       │
    └─────────────┘        └──────────────────┘

✅ FEATURES:
  ✓ Provider selection per student
  ✓ Student settings page
  ✓ Fallback mechanism
  ✓ Cost tracking per provider
  ✓ Rate limiting per provider
  ✓ Admin override capability
```

---

## KEY ADDITIONS NEEDED

### 1. DATABASE SCHEMA CHANGES
```sql
-- NEW COLUMNS for profiles table
ALTER TABLE profiles ADD (
  preferred_provider VARCHAR(20) DEFAULT 'azure',
  openrouter_api_key TEXT,
  provider_override VARCHAR(50),
  provider_override_reason TEXT
);

-- NEW TABLE for usage tracking
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  provider VARCHAR(20),
  model VARCHAR(100),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost DECIMAL(10, 4),
  correction_type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2. NEW ENVIRONMENT VARIABLES
```env
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL_TEXT=openai/gpt-4o-mini
OPENROUTER_MODEL_AUDIO=openai/whisper-1

# Provider Defaults
DEFAULT_PROVIDER=azure
ENABLE_FALLBACK=true
FALLBACK_TIMEOUT_MS=5000
```

---

### 3. API ROUTE REFACTORING
```typescript
// NEW: Provider detection
async function determineProvider(user: User): Promise<Provider> {
  const profile = await getProfile(user.id);
  
  // Admin override
  if (profile.provider_override) return parseOverride(profile.provider_override);
  
  // Student preference
  if (profile.preferred_provider === 'auto') {
    return await selectCheapestProvider();
  }
  
  return profile.preferred_provider || 'azure';
}

// NEW: Fallback logic
async function submitWithFallback(workflow, data, provider) {
  try {
    return await callN8nWorkflow(workflow, { ...data, provider });
  } catch (error) {
    if (provider === 'azure' && ENABLE_FALLBACK) {
      return await callN8nWorkflow(workflow, { ...data, provider: 'openrouter' });
    }
    throw error;
  }
}

// NEW: Cost tracking
async function logUsage(user_id, provider, model, tokens, cost) {
  await supabase.from('usage_logs').insert({
    user_id, provider, model, tokens, cost
  });
}
```

---

### 4. n8n WORKFLOWS (New Files)
```
CURRENT:
  ✓ n8n-workflows/text-correction.json
  ✓ n8n-workflows/audio-correction.json
  ✓ n8n-workflows/ocr-correction.json

NEED TO ADD:
  ✗ n8n-workflows/text-correction-openrouter.json
  ✗ n8n-workflows/audio-correction-openrouter.json
  ✗ n8n-workflows/ocr-correction-openrouter.json
  
EACH should:
  • Accept provider parameter from n8n webhook body
  • Route to correct API (Azure vs OpenRouter)
  • Handle different response formats
  • Return unified response schema
```

---

### 5. NEW PAGES & COMPONENTS
```
NEED TO ADD:
  ✗ src/app/(protected)/settings/page.tsx
    └─ Provider selection UI
    └─ API key input (OpenRouter)
    └─ Usage tracking display
    └─ Quota display

MODIFY:
  ~ src/app/(protected)/admin/approvals/ApprovalsClient.tsx
    └─ Add provider override column
    └─ Add reasoning field
```

---

## IMPLEMENTATION COMPLEXITY

| Task | Complexity | Time | Dependencies |
|------|-----------|------|--------------|
| **Phase 0: Unblockers** | Low | 2-4 hrs | None |
| **Phase 1A: OpenRouter Env Vars** | Low | 30 min | Phase 0 |
| **Phase 1B: DB Schema Updates** | Medium | 1-2 hrs | Phase 1A |
| **Phase 1C: n8n Workflows (3x)** | Medium | 3-4 hrs | Phase 1B |
| **Phase 1D: API Route Refactor** | Medium | 2-3 hrs | Phase 1C |
| **Phase 2: Settings Page** | Medium | 2-3 hrs | Phase 1D |
| **Phase 3: Fallback Logic** | Medium | 1-2 hrs | Phase 2 |
| **Phase 4: Monitoring** | Medium | 2-3 hrs | Phase 3 |
| **Total** | **Medium** | **3-4 weeks** | **Sequential** |

---

## CRITICAL QUESTIONS TO ANSWER BEFORE STARTING

### Business Questions
1. **Which provider is primary vs fallback?**
   - Azure as default, OpenRouter as backup?
   - Or auto-select based on cost?

2. **Student API keys?**
   - Allow students to bring own OpenRouter key?
   - Or institutional account only?

3. **Cost model?**
   - Charge students for usage?
   - Show cost transparency?
   - Implement quotas per student?

4. **Cohorts?**
   - Do all Skool members share Azure quota?
   - Or separate budgets per cohort?

### Technical Questions
5. **OpenRouter model selection?**
   - Fixed model (gpt-4o-mini) or user-selectable?
   - Different models for different countries/languages?

6. **Fallback strategy?**
   - Automatic if Azure times out?
   - Require explicit student choice?
   - Admin-controlled only?

7. **Usage limits?**
   - Per student: 100 corrections/month?
   - Per provider: Azure 1000 tokens/day?

8. **Legacy data?**
   - Existing corrections always counted against Azure?
   - Or migrate to usage_logs table?

---

## ROLLOUT SEQUENCE

### Week 1: Foundation (Phase 0-1)
- [ ] Add real Azure credentials
- [ ] Apply migration 002
- [ ] Add OpenRouter env vars
- [ ] Update profiles schema
- [ ] Create 3 new OpenRouter workflows
- [ ] Update API route with provider selection

### Week 2: Student Interface (Phase 2)
- [ ] Create settings page
- [ ] Add provider selection UI
- [ ] Add usage tracking display
- [ ] Add admin override capability

### Week 3: Reliability (Phase 3-4)
- [ ] Implement fallback logic
- [ ] Create usage_logs table
- [ ] Add rate limiting
- [ ] Create monitoring dashboard

### Week 4: Testing & Hardening
- [ ] Test both providers end-to-end
- [ ] Test fallback scenarios
- [ ] Load testing
- [ ] Cost tracking accuracy verification
- [ ] Documentation

---

## SUCCESS CRITERIA

✅ **Phase 1 Complete:**
- Both Azure and OpenRouter workflows available
- API route detects student preference
- Both providers produce identical response format
- All three correction types (text/audio/OCR) work with both providers

✅ **Phase 2 Complete:**
- Student can see their provider preference in settings
- Student can override with own OpenRouter key
- Admin can override provider per student
- Usage tracking visible to student

✅ **Phase 3 Complete:**
- Azure failures automatically fall back to OpenRouter
- Fallback is transparent to user
- Cost is tracked per provider
- Reports show provider usage distribution

✅ **Phase 4 Complete:**
- Rate limiting enforced per provider
- Admin dashboard shows quota usage
- Alerts when quota running low
- Cost per student calculated accurately

---

**Document generated from full codebase audit. See AUDIT_INITIAL_REQUIREMENTS_vs_CURRENT.md for detailed analysis.**
