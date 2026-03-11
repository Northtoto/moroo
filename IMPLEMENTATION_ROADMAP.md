# Morodeutsch Implementation Roadmap

> **Overall Status**: 🔴 BLOCKED (Phase 0 prerequisites required)
> 
> **Documentation Created**: ✅ Complete  
> **Platform Audit**: ✅ Complete  
> **Gap Analysis**: ✅ Complete  
> **Implementation Plan**: ✅ Ready  
> **Code Implementation**: ⏳ Awaiting Phase 0 completion

---

## Project Overview

**Goal**: Transform morodeutsch from single-provider (Azure-only) to **dual-provider system** supporting both Azure OpenAI and OpenRouter, with student-configurable provider selection.

**Current Stack**:
- Next.js 16.1.6 (TypeScript)
- Supabase (Auth + Database)
- n8n 2.77.0 (Workflow orchestration)
- Azure OpenAI (GPT-5.2, Whisper)
- Tesseract.js (Client-side OCR)

**Target Architecture**:
- Multi-provider support (Azure primary, OpenRouter fallback/alternative)
- Student-selectable preferences
- Per-student cost tracking
- Automatic fallback on provider errors
- Admin override capability

---

## DOCUMENTATION COMPLETED

### 1. **AUDIT_INITIAL_REQUIREMENTS_vs_CURRENT.md** (447 lines)
Comprehensive comparison of initial requirements vs current implementation.

**Contents**:
- Initial requirements analysis (user's stated needs)
- Current implementation inventory
- 4 critical gaps identified
- Detailed requirements vs current table
- 4-phase implementation roadmap (3-4 weeks)
- Phase 1-4 breakdown with code examples
- 11 critical questions to answer before implementation

**When to use**: Reference this before starting implementation to understand what's missing and why.

### 2. **ARCHITECTURE_GAPS_SUMMARY.md** (334 lines)
Visual architecture comparison and implementation checklist.

**Contents**:
- Current architecture diagram (Azure-only)
- Required architecture diagram (Azure + OpenRouter)
- Key additions needed (database, env vars, API, workflows, UI)
- Implementation complexity matrix
- Critical questions
- Rollout sequence by week
- Success criteria per phase

**When to use**: Reference this for visual understanding and task breakdown.

### 3. **PHASE_0_UNBLOCKERS.md** (383 lines) ← NEW
Critical prerequisites that must be completed before ANY implementation work.

**Contents**:
- 5 blockers/issues preventing platform functionality
- How to fix each blocker with step-by-step instructions
- Testing checklist to verify Phase 0 complete
- File location reference table
- What's next after Phase 0

**When to use**: START HERE. Complete all Phase 0 items before proceeding with Phase 1.

---

## IMPLEMENTATION PHASES

### PHASE 0: Unblockers (15-30 minutes)
**⏳ Status**: NOT STARTED  
**Purpose**: Fix critical blockers preventing platform functionality

| Item | Issue | Fix Time | Difficulty |
|------|-------|----------|------------|
| Blocker #1 | .env.local has all placeholder values | 5 min | 🟢 Easy |
| Blocker #2 | Migration 002 not applied to database | 5-10 min | 🟢 Easy |
| Blocker #3 | Profile trigger may not set approval_status | 5 min | 🟢 Easy |
| Issue #4 | Auth callback missing error handling | 10 min | 🟡 Medium |
| Issue #5 | Admin dashboard may be incomplete | 5-15 min | 🟡 Medium |

**Deliverables after Phase 0**:
- ✅ Platform can connect to Supabase/n8n/Azure
- ✅ Approval flow works (pending/approved/rejected)
- ✅ Admin can approve/reject users
- ✅ All environment variables properly configured
- ✅ Database migrations applied

**Go/No-Go**: Must pass all 6 tests in PHASE_0_UNBLOCKERS.md before proceeding.

---

### PHASE 1: Multi-Provider Foundation (2.5-3 hours)

**Status**: READY TO START (after Phase 0)  
**Purpose**: Add OpenRouter as alternative provider alongside Azure

#### Phase 1A: Infrastructure (1 hour)
- Add OpenRouter environment variables to .env.example
- Create database migration: add `preferred_provider` and `openrouter_api_key` columns to profiles
- Add OpenRouter type definitions to `src/types/index.ts`

**Files to create/modify**:
- `.env.example` - add 4 new OPENROUTER_* variables
- `supabase/migrations/003_add_openrouter_fields.sql` - new migration
- `src/types/index.ts` - extend Profile interface

**Time**: 20-30 minutes

#### Phase 1B: Workflows (1 hour)
- Create 3 new n8n workflows for OpenRouter:
  - `text-correction-openrouter.json`
  - `audio-correction-openrouter.json`
  - `ocr-correction-openrouter.json`
- Copy structure from Azure workflows, modify endpoints

**Files to create**:
- `n8n-workflows/text-correction-openrouter.json`
- `n8n-workflows/audio-correction-openrouter.json`
- `n8n-workflows/ocr-correction-openrouter.json`

**Time**: 30-40 minutes

#### Phase 1C: API Route Refactoring (30-45 minutes)
- Implement `determineProvider()` function in API route
- Add request validation
- Route requests to correct n8n workflow based on provider
- Add error logging

**Files to modify**:
- `src/app/api/tutor/route.ts` - add provider selection logic

**Time**: 30-45 minutes

**Deliverables after Phase 1**:
- ✅ OpenRouter environment variables configured
- ✅ Database schema supports both providers
- ✅ n8n workflows available for OpenRouter
- ✅ API intelligently routes to correct provider
- ✅ All corrections work with either provider

**Test**: Send text/audio/image corrections via `/api/tutor` with different providers.

---

### PHASE 2: Student Configuration (1.5-2 hours)

**Status**: DESIGN READY  
**Purpose**: Let students choose their preferred provider and configure API keys

#### Phase 2A: Settings Page (45 minutes)
- Create `/settings` or `/dashboard/settings` page
- Form with provider selection dropdown
- Optional OpenRouter API key input (for advanced users)
- Save preferences to profiles table

**Files to create**:
- `src/app/(protected)/settings/page.tsx` (or `/dashboard/settings/page.tsx`)
- `src/app/(protected)/settings/page-client.tsx` (interactive component)

#### Phase 2B: Middleware Updates (15 minutes)
- Update tutor API route to respect student's preferred_provider
- If student set `preferred_provider = 'openrouter'`, use OpenRouter workflows
- Fallback to Azure if provider not set

#### Phase 2C: Admin Override (30 minutes)
- Extend admin dashboard to allow provider assignment to students
- Add column showing student's preferred provider
- Button to change provider on behalf of student

**Files to modify**:
- `src/app/(protected)/admin/approvals/ApprovalsClient.tsx` - add provider column/controls
- `src/app/(protected)/admin/actions.ts` - add updateStudentProvider action

**Deliverables after Phase 2**:
- ✅ Students can view current provider
- ✅ Students can choose preferred provider
- ✅ API uses student's preference
- ✅ Admin can override student's choice
- ✅ Settings persist to database

**Test**: 
1. Log in as student
2. Visit settings page
3. Change provider preference
4. Send correction - verify correct provider used
5. Log in as admin
6. Override student's provider
7. Verify student sees updated preference

---

### PHASE 3: Fallback & Cost Tracking (1.5-2 hours)

**Status**: DESIGN READY  
**Purpose**: Automatic fallback on errors, track costs per provider

#### Phase 3A: Fallback Logic (30-45 minutes)
- Create fallback strategy in API route:
  - Primary provider fails → try fallback provider
  - Log error + provider that failed
  - Return success from either provider
- Add `DEFAULT_FALLBACK_PROVIDER` env var
- Update n8n workflows with error handling

#### Phase 3B: Usage Logging (30-45 minutes)
- Create `usage_logs` table to track:
  - User ID, timestamp, provider used, tokens used, cost
  - Correction type (text/audio/image)
  - Success/failure status
- Create server action to log usage
- Call logging action after each API call succeeds

**Files to create**:
- `supabase/migrations/004_create_usage_logs_table.sql`
- `src/lib/usage-logging.ts` (logging utility)

**Files to modify**:
- `src/app/api/tutor/route.ts` - add fallback logic + usage logging

#### Phase 3C: Cost Tracking Dashboard (30 minutes - optional for Phase 3)
- Extend admin dashboard with usage statistics
- Show: corrections per provider, total cost per student, cost trends
- Export usage data as CSV

**Deliverables after Phase 3**:
- ✅ Provider fails → fallback automatically used
- ✅ All usage logged to database
- ✅ Cost tracking per provider and student
- ✅ Admin can view usage statistics

**Test**:
1. Stop Azure service
2. Send correction - should fallback to OpenRouter
3. Check usage_logs table - records both failure + fallback
4. Resume Azure
5. Send correction - should use primary again

---

### PHASE 4: Monitoring & Optimization (1-1.5 hours)

**Status**: DESIGN READY  
**Purpose**: Rate limiting, performance monitoring, admin controls

#### Phase 4A: Rate Limiting (30-45 minutes)
- Implement per-user rate limiting in API route
- Limits: 50 corrections/day per student (configurable)
- Return 429 if limit exceeded
- Track in Redis or simple in-memory store

#### Phase 4B: Admin Controls (15-30 minutes)
- Extend admin dashboard:
  - Disable provider globally if having issues
  - Set per-student limits
  - View real-time provider health
  - Manual cost adjustment

#### Phase 4C: Monitoring (15 minutes)
- Add error tracking (Sentry or similar)
- Monitor n8n workflow success rates
- Alert on provider failures

**Deliverables after Phase 4**:
- ✅ Rate limiting prevents abuse
- ✅ Admin can disable providers temporarily
- ✅ Monitoring alerts on issues
- ✅ Performance optimized

---

## TIMELINE & EFFORT ESTIMATES

| Phase | Effort | Time | Difficulty | Status |
|-------|--------|------|-----------|--------|
| Phase 0 | MVP | 15-30 min | 🟢 Easy | ⏳ NOT STARTED |
| Phase 1 | MVP | 2.5-3 hrs | 🟡 Medium | READY |
| Phase 2 | MVP | 1.5-2 hrs | 🟡 Medium | READY |
| Phase 3 | MVP | 1.5-2 hrs | 🟡 Medium | READY |
| Phase 4 | NICE | 1-1.5 hrs | 🟡 Medium | READY |
| **TOTAL MVP** | - | **5.5-7.5 hrs** | - | **After Phase 0** |
| **TOTAL WITH PHASE 4** | - | **6.5-9 hrs** | - | **After Phase 0** |

---

## CRITICAL QUESTIONS TO ANSWER BEFORE PHASE 1

Before starting Phase 1 implementation, decide on these business/technical questions:

### Provider Priority
1. **Which provider should be primary?** (Azure vs OpenRouter)
2. **What's the fallback strategy?** (Always to OpenRouter? To cheapest? Manual override?)
3. **Should students be allowed to choose?** Or admin assignment only?

### Cost & Budget
4. **What's your cost model?** (Per student? Per correction? Monthly cap?)
5. **Should students see costs?** Or only internal tracking?
6. **Budget limits per student?** Or unlimited?

### Credentials & Security
7. **Should students provide their own OpenRouter keys?** Or use shared org key?
8. **How to store student API keys securely?** (encrypted DB field?)
9. **Can students see their own keys?** Or admin-only visibility?

### Rate Limiting
10. **What limits per student?** (corrections/day, tokens/month, etc.)
11. **How to handle limit exceeded?** (Queue, error message, upgrade option?)

### Monitoring
12. **Who gets alerted on provider failures?** (Admin email, webhook, Slack?)
13. **What metrics matter most?** (Cost, latency, success rate, student experience?)

---

## HOW TO USE THIS ROADMAP

### If You're Starting Fresh:
1. **Read**: PHASE_0_UNBLOCKERS.md (start here)
2. **Complete**: All 5 Phase 0 items
3. **Verify**: All 6 tests pass
4. **Read**: ARCHITECTURE_GAPS_SUMMARY.md (for context)
5. **Answer**: 13 critical questions above
6. **Proceed**: Phase 1A, then 1B, then 1C in order

### If You Want to Skip Ahead:
- Each phase can be read independently
- BUT Phase 0 must be complete first
- Phases 1-4 build on each other (1→2→3→4)
- Phase 4 is optional (nice-to-have)

### If You Get Stuck:
- Check relevant phase's documentation
- Verify all previous phases complete
- Review test checklist
- Check file locations table

---

## QUICK LINKS

| Document | Purpose | When to Read |
|----------|---------|--------------|
| AUDIT_INITIAL_REQUIREMENTS_vs_CURRENT.md | Understand gap between requirements and current state | Before Phase 1 |
| ARCHITECTURE_GAPS_SUMMARY.md | Visual architecture comparison and detailed task list | Before Phase 1 |
| PHASE_0_UNBLOCKERS.md | Fix critical issues preventing platform functionality | **START HERE** |
| IMPLEMENTATION_ROADMAP.md | High-level timeline and phase breakdown (this file) | For overview |

---

## SUCCESS CRITERIA

Platform is successfully multi-provider enabled when:

✅ **Phase 0 Complete**: Platform can connect to all services, approval flow works  
✅ **Phase 1 Complete**: Both Azure and OpenRouter can be used interchangeably  
✅ **Phase 2 Complete**: Students can select their preferred provider  
✅ **Phase 3 Complete**: Automatic fallback on errors, costs tracked  
✅ **Phase 4 Complete**: Rate limiting, monitoring, admin controls in place  

---

## NEXT IMMEDIATE STEPS

1. **Read**: PHASE_0_UNBLOCKERS.md (in full)
2. **Get**: Supabase credentials (project URL, keys)
3. **Get**: n8n webhook secret and password
4. **Get**: Azure OpenAI endpoint and API key
5. **Update**: .env.local with real values
6. **Apply**: Migration 002 to database
7. **Test**: Complete all 6 verification tests
8. **Confirm**: Phase 0 complete, ready for Phase 1

---

## ARCHITECTURE DIAGRAM: What Gets Added

```
CURRENT (Azure-only):
┌─────────────────┐
│  Next.js App    │
│   /api/tutor    │
└────────┬────────┘
         │
         └──→ n8n Webhook
              │
              └──→ Azure OpenAI (GPT-5.2)
              └──→ Azure Whisper (STT)
              └──→ Client Tesseract (OCR)

PHASE 1 (OpenRouter Added):
┌─────────────────┐
│  Next.js App    │
│   /api/tutor    │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ Provider  │ (new: determineProvider)
    │ Selection │ Logic here
    └────┬─────┘
         │
    ┌────┴────┬────────────┐
    │          │            │
  Azure    OpenRouter   Client
  n8n      n8n        Tesseract
 (x3)      (x3)         (OCR)

PHASE 2 (Student Preferences):
┌─────────────────┐
│  Next.js App    │
│   /api/tutor    │
│  /settings      │ (new page)
│  /dashboard     │ (updated)
└────────┬────────┘
         │
    ┌────▼──────────────┐
    │ Provider Selection │ (reads: student.preferred_provider)
    │ + Student Prefs   │ from database
    └────┬──────────────┘
         │
    ┌────┴────┬────────────┐
    │          │            │
  Azure    OpenRouter   Client
  n8n      n8n        Tesseract

PHASE 3 (Fallback + Logging):
┌──────────────────────┐
│  Next.js App         │
│  /api/tutor          │
│  + Fallback Logic    │ (new)
│  + Usage Logging     │ (new)
└────────┬─────────────┘
         │
    ┌────▼────────────────┐
    │ Try Primary Provider │
    │ If fails → Fallback  │
    │ Log to usage_logs    │ (new table)
    └────┬────────────────┘
         │
    ┌────┴────┬────────────┐
    │          │            │
  Azure    OpenRouter   Client
  n8n      n8n        Tesseract

PHASE 4 (Monitoring):
┌─────────────────────┐
│  Next.js App        │
│  + Rate Limiting    │
│  + Monitoring       │
│  Admin Controls     │
└────────┬────────────┘
         │
    ┌────▼────────────────┐
    │ Provider Selection   │
    │ + Fallback Logic     │
    │ + Usage Logging      │
    │ + Rate Limits        │
    └────┬────────────────┘
         │
    ┌────┴────┬────────────┐
    │          │            │
  Azure    OpenRouter   Client
  n8n      n8n        Tesseract
```

