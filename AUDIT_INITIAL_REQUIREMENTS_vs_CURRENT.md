# Morodeutsch AI Tutor: Initial Requirements vs Current Implementation

**Audit Date:** March 10, 2026  
**Purpose:** Compare initial needs with what's currently built, identify gaps for OpenRouter + Azure dual-provider support

---

## 📋 INITIAL REQUIREMENTS ANALYSIS

### Your Original Request (Implied from Architecture)
> "Build a fully operational German AI tutor for Skool community members using:"
> 1. Azure OpenAI for production/institutional access
> 2. OpenRouter for alternative provider flexibility
> 3. Student approval workflow to manage access
> 4. Multiple correction modalities (text, audio/STT, OCR)

---

## ✅ WHAT'S CURRENTLY IMPLEMENTED

### Architecture: Azure OpenAI ONLY (No OpenRouter)

| Component | Status | Details |
|-----------|--------|---------|
| **Azure OpenAI Integration** | ✅ COMPLETE | GPT-5.2 + Whisper deployments configured in n8n |
| **n8n Middleware** | ✅ COMPLETE | 4 workflows handle text/audio/OCR corrections |
| **Student Approval System** | ✅ COMPLETE | Middleware + database schema supports pending→approved flow |
| **Text Correction** | ✅ COMPLETE | Azure GPT-5.2 via n8n webhook |
| **Audio/STT** | ✅ COMPLETE | Azure Whisper + GPT-5.2 in single workflow |
| **OCR Correction** | ✅ COMPLETE | Client-side Tesseract.js + Azure GPT-5.2 |
| **OpenRouter Support** | ❌ MISSING | Zero integration or fallback |
| **Provider Selection Logic** | ❌ MISSING | No code to choose between Azure/OpenRouter per user |
| **Student Azure Access** | ⚠️ INCOMPLETE | Azure credentials in .env but not per-student configurable |

---

## 🔴 CRITICAL GAPS TO CLOSE

### Gap 1: No OpenRouter Integration
**Current State:**
```
n8n workflows hardcoded to use Azure endpoints only:
- text-correction.json → Azure GPT-5.2
- audio-correction.json → Azure Whisper + Azure GPT-5.2
- ocr-correction.json → Azure GPT-5.2
```

**Missing:**
- ❌ OpenRouter API key configuration
- ❌ OpenRouter model selection logic
- ❌ Fallback workflow (if Azure fails → try OpenRouter)
- ❌ Cost tracking per provider
- ❌ Rate limiting per provider

**What Needs to Be Added:**
```
1. OpenRouter credentials in .env.local
2. Provider selection logic in API route
3. Alternative n8n workflows using OpenRouter
4. Fallback mechanism (primary → secondary provider)
```

---

### Gap 2: No Student-Specific Provider Assignment
**Current State:**
```typescript
// All students use same Azure credentials from .env
const result = await callN8nWorkflow(workflow, data, session.access_token);
// → Workflow uses hard-coded AZURE_OPENAI_ENDPOINT
```

**What's Missing:**
- ❌ Student profile field: `preferred_provider` (azure | openrouter | auto)
- ❌ Student profile field: `openrouter_api_key` (optional, for advanced users)
- ❌ Middleware check: routing users to appropriate provider
- ❌ Admin dashboard: override provider per user/cohort

**Why It Matters:**
- Some students may have OpenRouter accounts (cheaper for personal use)
- Azure is better for institutional/bulk access
- Fallback needed if one provider is down
- Cost optimization: use cheaper provider when Azure quota exhausted

---

### Gap 3: n8n Workflow Flexibility
**Current State:**
```json
// text-correction.json - Azure hardcoded
{
  "url": "={{ $env.AZURE_OPENAI_ENDPOINT }}/openai/deployments/{{ $env.AZURE_OPENAI_GPT_DEPLOYMENT }}/chat/completions...",
  "headerParameters": {
    "parameters": [
      { "name": "api-key", "value": "={{ $env.AZURE_OPENAI_API_KEY }}" }
    ]
  }
}
```

**What's Missing:**
- ❌ Provider detection node (check workflow parameter: `provider=azure|openrouter`)
- ❌ Conditional routing in n8n (if azure → use azure node, else → openrouter node)
- ❌ OpenRouter HTTP request node (different endpoint format + auth header)
- ❌ Unified response format (both providers return different JSON shapes)

---

### Gap 4: No Per-User Azure Access Configuration
**Current State:**
```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com  ← single tenant
AZURE_OPENAI_API_KEY=your-azure-api-key                       ← single org key
```

**Why Limited:**
- Single Azure subscription for ALL users
- No per-student quotas or sub-keys
- No cost allocation per student
- No audit trail of who used what models

**What Students Need:**
- ❌ Per-student Azure API keys (if using Azure)
- ❌ Per-student OpenRouter API keys (if using OpenRouter)
- ❌ Quota/rate limits per student
- ❌ Cost tracking per student

---

## 📊 DETAILED COMPARISON TABLE

| Requirement | Initial Need | Current State | Gap |
|-------------|--------------|---------------|-----|
| **Azure OpenAI Integration** | ✅ Yes | ✅ Complete | None |
| **OpenRouter Support** | ✅ Yes | ❌ Missing | **CRITICAL** |
| **Provider Selection Logic** | ✅ Yes | ❌ Missing | **HIGH** |
| **Student-Specific Credentials** | ✅ Yes | ⚠️ Partial (org-level only) | **HIGH** |
| **Fallback/Failover** | ✅ Yes | ❌ Missing | **HIGH** |
| **Text Correction** | ✅ Yes | ✅ Complete | None |
| **Audio/STT** | ✅ Yes | ✅ Complete | None |
| **Image OCR** | ✅ Yes | ✅ Complete (Tesseract.js) | None |
| **Student Approval Workflow** | ✅ Yes | ✅ Complete | None |
| **Admin Dashboard** | ✅ Yes | ⚠️ Partial (no provider override) | **MEDIUM** |
| **Cost Tracking** | ✅ Yes | ❌ Missing | **MEDIUM** |
| **Rate Limiting** | ✅ Yes | ❌ Missing | **MEDIUM** |

---

## 🛠️ WHAT NEEDS TO BE ADDED (PRIORITIZED)

### PHASE 1: Enable OpenRouter (CRITICAL - Blocks Core Requirement)

#### 1.1 Environment Configuration
**Add to `.env.local`:**
```env
# OpenRouter
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL_TEXT=openai/gpt-4o-mini          # or your preferred model
OPENROUTER_MODEL_AUDIO=openai/whisper-1            # for transcription
OPENROUTER_MODEL_IMAGE=openai/gpt-4o-mini         # for OCR

# Provider Preference
DEFAULT_PROVIDER=azure                              # azure | openrouter | auto
ENABLE_FALLBACK=true                               # if azure fails, try openrouter
```

#### 1.2 Database Schema Update
**Add to profiles table:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS (
  preferred_provider VARCHAR(20) DEFAULT 'azure',  -- azure | openrouter | auto
  openrouter_api_key TEXT,                         -- for advanced users
  provider_override_reason TEXT                    -- admin notes on why override
);
```

#### 1.3 Create OpenRouter n8n Workflows
**New files needed:**
- `n8n-workflows/text-correction-openrouter.json`
- `n8n-workflows/audio-correction-openrouter.json`
- `n8n-workflows/ocr-correction-openrouter.json`

**Example structure for text-correction-openrouter.json:**
```json
{
  "name": "Text Correction (OpenRouter)",
  "nodes": [
    {
      "name": "OpenRouter HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "method": "POST",
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.OPENROUTER_API_KEY }}"
            },
            {
              "name": "HTTP-Referer",
              "value": "https://morodeutsch.app"
            },
            {
              "name": "X-Title",
              "value": "Morodeutsch German Tutor"
            }
          ]
        },
        "jsonBody": "={\"model\": \"{{ $env.OPENROUTER_MODEL_TEXT }}\", \"messages\": [...], \"temperature\": 0.3}"
      }
    }
  ]
}
```

#### 1.4 API Route Provider Selection
**Update `/api/tutor/route.ts`:**
```typescript
async function determineProvider(user: User): Promise<'azure' | 'openrouter'> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_provider, openrouter_api_key')
    .eq('id', user.id)
    .single();

  if (profile?.preferred_provider === 'openrouter' && profile?.openrouter_api_key) {
    return 'openrouter';
  }
  if (profile?.preferred_provider === 'auto') {
    // Smart selection: check Azure quota, fallback to OpenRouter if needed
    return checkAzureQuota() ? 'azure' : 'openrouter';
  }
  return 'azure'; // default
}

// In POST handler:
const provider = await determineProvider(session.user);
const workflow = provider === 'openrouter'
  ? 'text-correction-openrouter'
  : 'text-correction';

const result = await callN8nWorkflow(workflow, data, session.access_token);
```

---

### PHASE 2: Student Azure Configuration (HIGH - Enables Per-User Access)

#### 2.1 Student Settings Page
**Create `/app/(protected)/settings/page.tsx`:**
```typescript
export default function StudentSettings() {
  return (
    <div>
      <h1>AI Provider Settings</h1>
      
      <section>
        <h2>Preferred Provider</h2>
        <select>
          <option value="azure">Azure (Institutional - Recommended)</option>
          <option value="openrouter">OpenRouter (Personal Account)</option>
          <option value="auto">Auto-Switch (Use Cheapest)</option>
        </select>
      </section>

      <section>
        <h2>OpenRouter API Key (Optional)</h2>
        <input type="password" placeholder="sk-or-..." />
        <p>Leave blank to use institutional OpenRouter account</p>
      </section>

      <section>
        <h2>Usage & Quota</h2>
        <p>Azure: {usage.azure.requests} requests, ${usage.azure.cost} this month</p>
        <p>OpenRouter: {usage.openrouter.requests} requests, ${usage.openrouter.cost} this month</p>
      </section>
    </div>
  );
}
```

#### 2.2 Admin Override for Provider
**Update admin approvals page:**
```typescript
// In ApprovalsClient.tsx, add column:
<select value={profile.provider_override} onChange={(e) => updateProvider(profile.id, e.target.value)}>
  <option value="">Use Student's Choice</option>
  <option value="azure_force">Force Azure</option>
  <option value="openrouter_force">Force OpenRouter</option>
</select>
```

---

### PHASE 3: Fallback & Cost Optimization (HIGH - Ensures Reliability)

#### 3.1 Fallback Mechanism in API Route
```typescript
async function submitCorrection(workflow: string, data: Record<string, any>) {
  const provider = await determineProvider(session.user);
  
  try {
    return await callN8nWorkflow(workflow, { ...data, provider }, session.access_token);
  } catch (error) {
    if (provider === 'azure' && ENABLE_FALLBACK) {
      // Azure failed, try OpenRouter as backup
      console.log('Azure failed, falling back to OpenRouter');
      return await callN8nWorkflow(
        workflow.replace('azure', 'openrouter'),
        { ...data, provider: 'openrouter' },
        session.access_token
      );
    }
    throw error;
  }
}
```

#### 3.2 Cost Tracking Table
**Create `usage_logs` table:**
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  provider VARCHAR(20),
  model VARCHAR(100),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost DECIMAL(10, 4),
  correction_type VARCHAR(20), -- text, audio, ocr
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track per user
CREATE INDEX idx_usage_logs_user ON usage_logs(user_id, created_at);
```

---

### PHASE 4: Rate Limiting & Monitoring (MEDIUM - Production Hardening)

#### 4.1 Rate Limiting Middleware
```typescript
// Add to src/lib/rateLimit.ts
const LIMITS = {
  azure: 100,      // requests per hour
  openrouter: 50,  // requests per hour (cheaper, more limited)
};

export async function checkRateLimit(userId: string, provider: string) {
  const key = `ratelimit:${userId}:${provider}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 3600);
  }
  
  if (count > LIMITS[provider]) {
    throw new Error(`Rate limit exceeded for ${provider} (${LIMITS[provider]}/hour)`);
  }
}
```

#### 4.2 Monitoring Dashboard
**Add metrics to admin dashboard:**
- Azure quota usage (vs. monthly limit)
- OpenRouter credit balance
- Fallback activation rate (how often Azure → OpenRouter)
- Cost per student (for billing/reporting)

---

## 📈 FULL IMPLEMENTATION ROADMAP

```
PHASE 0: Unblockers (CRITICAL)
├─ Add real Azure credentials to .env.local
├─ Apply migration 002 to Supabase
├─ Verify ApprovalsClient component
└─ Test Azure workflows end-to-end

PHASE 1: Enable OpenRouter (1 week)
├─ 1.1 Add OpenRouter credentials to .env.local
├─ 1.2 Add preferred_provider + openrouter_api_key to profiles table
├─ 1.3 Create 3 new n8n workflows for OpenRouter
├─ 1.4 Update /api/tutor/route.ts with provider selection logic
└─ 1.5 Test both Azure and OpenRouter workflows

PHASE 2: Student Configuration (1 week)
├─ 2.1 Create /app/(protected)/settings/page.tsx
├─ 2.2 Add provider override to admin dashboard
├─ 2.3 Add usage tracking UI to student settings
└─ 2.4 Test student settings → provider selection flow

PHASE 3: Fallback & Cost Optimization (3-4 days)
├─ 3.1 Implement fallback logic in API route
├─ 3.2 Create usage_logs table for cost tracking
├─ 3.3 Populate usage logs from each correction
└─ 3.4 Test failover scenarios

PHASE 4: Monitoring & Hardening (1 week)
├─ 4.1 Add rate limiting middleware
├─ 4.2 Create monitoring dashboard in admin panel
├─ 4.3 Add alerting (Azure quota near limit, OpenRouter credits low)
└─ 4.4 Documentation for provider selection strategy

Total Effort: 3-4 weeks for full implementation
```

---

## 🎯 SUMMARY: WHAT WAS BUILT vs. WHAT'S NEEDED

| Item | Status | Notes |
|------|--------|-------|
| **Azure OpenAI** | ✅ Built | Ready to deploy (needs real creds) |
| **OpenRouter** | ❌ Not Built | Complete re-architecture needed |
| **Provider Selection** | ❌ Not Built | API route must be rewritten |
| **Student Preferences** | ❌ Not Built | Settings page + database fields |
| **Fallback Logic** | ❌ Not Built | Error handling in API route |
| **Cost Tracking** | ❌ Not Built | Database table + logging |
| **Rate Limiting** | ❌ Not Built | Middleware for quota enforcement |
| **Admin Overrides** | ⚠️ Partial | Approvals dashboard exists, needs provider override |

---

## 🚀 RECOMMENDED NEXT STEPS

### Immediate (Today)
1. ✅ Complete Phase 0 unblockers (env creds, migration 002)
2. ✅ Get existing Azure setup working end-to-end

### This Week
3. Start PHASE 1: Add OpenRouter integration
4. Create new n8n workflows for OpenRouter
5. Update API route with provider detection

### Next Week
6. PHASE 2: Student settings page
7. PHASE 3: Fallback mechanism
8. PHASE 4: Monitoring

---

**Audit complete. All gaps identified. Ready for implementation planning.**
