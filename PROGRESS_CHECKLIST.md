# Morodeutsch Implementation Progress Checklist

> Print this page or track digitally to monitor progress through all phases.

---

## PHASE 0: Critical Unblockers

**Status**: ⏳ Not Started | ⚠️ In Progress | ✅ Complete

### Blocker #1: Environment Variables
- [ ] Get Supabase URL from project settings
- [ ] Get Supabase ANON_KEY from project settings
- [ ] Get Supabase SERVICE_ROLE_KEY from project settings
- [ ] Get n8n webhook secret (generate random string)
- [ ] Get n8n admin password (from n8n setup)
- [ ] Get Azure OpenAI endpoint from Azure console
- [ ] Get Azure OpenAI API key from Azure console
- [ ] Update .env.local with all 11 values
- [ ] Verify no placeholder values remain in .env.local
- [ ] Test: `npm run build` completes without env errors

### Blocker #2: Database Migration 002
- [ ] Confirm migration file exists: `supabase/migrations/002_add_approval_flow.sql`
- [ ] Read migration file to understand changes
- [ ] Run: `supabase link` (connect to Supabase project)
- [ ] Run: `supabase db push` (apply migrations)
- [ ] OR manually execute SQL in Supabase console
- [ ] Verify query returns 5 columns in profiles table:
  ```sql
  SELECT COUNT(*) as column_count FROM information_schema.columns 
  WHERE table_name = 'profiles' 
  AND column_name IN ('approval_status', 'approved_at', 'rejection_reason', 'is_admin', 'signup_source')
  ```

### Blocker #3: Profile Trigger approval_status
- [ ] Start dev server: `npm run dev`
- [ ] Go to `/signup` form
- [ ] Sign up with test email (e.g., test-blocker3@example.com)
- [ ] Check Supabase: `SELECT approval_status FROM profiles WHERE email = 'test-blocker3@example.com'`
- [ ] If NULL or missing: Update trigger to set approval_status = 'pending'
- [ ] Re-test with new signup
- [ ] Verify approval_status = 'pending' for all new signups

### Issue #4: Auth Callback Error Handling
- [ ] Open `src/app/auth/callback/route.ts`
- [ ] Check if profile lookup has error handling (look for `error` check)
- [ ] If missing: Add error handling code (see PHASE_0_UNBLOCKERS.md)
- [ ] Test: Manually trigger profile lookup failure
- [ ] Verify: Error redirects to login with appropriate message

### Issue #5: Admin Dashboard
- [ ] Check if file exists: `src/app/(protected)/admin/actions.ts`
- [ ] Check if file exists: `src/app/(protected)/admin/approvals/ApprovalsClient.tsx`
- [ ] If missing: Create server actions file with approveUser/rejectUser functions
- [ ] If missing: Create client component with approve/reject buttons
- [ ] Set test user `is_admin = true` in database
- [ ] Log in as admin
- [ ] Visit `/admin/approvals`
- [ ] Verify page loads (no errors)
- [ ] Verify pending users display
- [ ] Verify approve/reject buttons work

### Phase 0 Testing
- [ ] ✅ Test 1: `npm run build` completes
- [ ] ✅ Test 2: Signup form works, profile created with approval_status='pending'
- [ ] ✅ Test 3: Auth callback redirects to /approval-pending
- [ ] ✅ Test 4: Admin approval_status change → can access /dashboard
- [ ] ✅ Test 5: Rejection → redirected to /access-denied
- [ ] ✅ Test 6: Admin can access /admin/approvals and approve/reject

### Phase 0 Sign-Off
- [ ] All 5 blockers/issues resolved
- [ ] All 6 tests passing
- [ ] Date completed: _______________
- [ ] Ready for Phase 1: YES / NO

---

## PHASE 1: Multi-Provider Foundation

**Status**: ⏳ Not Started | ⚠️ In Progress | ✅ Complete

### Phase 1A: Infrastructure (20-30 min)
- [ ] Answer: Which provider primary? (Azure / OpenRouter)
- [ ] Answer: Fallback strategy? (Always OpenRouter / Cheapest / Manual)
- [ ] Add to `.env.example`:
  - [ ] OPENROUTER_API_KEY
  - [ ] OPENROUTER_MODEL_TEXT
  - [ ] OPENROUTER_MODEL_AUDIO
  - [ ] OPENROUTER_MODEL_IMAGE
- [ ] Create migration: `supabase/migrations/003_add_openrouter_fields.sql`
  - [ ] Add column: `preferred_provider` (TEXT DEFAULT 'azure')
  - [ ] Add column: `openrouter_api_key` (TEXT DEFAULT NULL)
  - [ ] Create index on preferred_provider
- [ ] Update `.env.local` with OpenRouter API key
- [ ] Run: `supabase db push` (apply migration 003)
- [ ] Update `src/types/index.ts` Profile interface:
  - [ ] Add preferred_provider field
  - [ ] Add openrouter_api_key field
- [ ] Test: TypeScript compilation without errors

### Phase 1B: n8n Workflows (30-40 min)
- [ ] Copy `n8n-workflows/text-correction.json` → `text-correction-openrouter.json`
- [ ] Update n8n workflow endpoint from Azure → OpenRouter:
  - [ ] Change base URL to OpenRouter endpoint
  - [ ] Change auth header to use OPENROUTER_API_KEY
  - [ ] Update request body for OpenRouter format
  - [ ] Test in n8n UI with sample request
- [ ] Copy `n8n-workflows/audio-correction.json` → `audio-correction-openrouter.json`
  - [ ] Update endpoint
  - [ ] Test with sample audio
- [ ] Copy `n8n-workflows/ocr-correction.json` → `ocr-correction-openrouter.json`
  - [ ] Update endpoint
  - [ ] Test with sample image
- [ ] All 3 workflows tested in n8n UI

### Phase 1C: API Route Refactoring (30-45 min)
- [ ] Open `src/app/api/tutor/route.ts`
- [ ] Create function: `determineProvider(userId, contentType)`
  - [ ] If user has preferred_provider → use that
  - [ ] Else default to AZURE_OPENAI
  - [ ] Return: 'azure' | 'openrouter'
- [ ] Modify POST handler:
  - [ ] Get user ID from session
  - [ ] Call determineProvider()
  - [ ] Route to correct n8n workflow based on provider
  - [ ] (e.g., "text-correction-azure" or "text-correction-openrouter")
- [ ] Add request logging (console.log provider + content type)
- [ ] Test: Send correction request, check logs show correct provider
- [ ] Test: Both providers return valid responses
- [ ] Test: Error handling if workflow fails

### Phase 1 Integration Testing
- [ ] Text correction works with Azure
- [ ] Text correction works with OpenRouter
- [ ] Audio correction works with Azure
- [ ] Audio correction works with OpenRouter
- [ ] Image correction works with Azure
- [ ] Image correction works with OpenRouter
- [ ] Error handling works (n8n offline → graceful error)
- [ ] Logs show which provider was used

### Phase 1 Sign-Off
- [ ] All workflows operational
- [ ] API route correctly routes to both providers
- [ ] All tests passing
- [ ] Date completed: _______________
- [ ] Ready for Phase 2: YES / NO

---

## PHASE 2: Student Configuration

**Status**: ⏳ Not Started | ⚠️ In Progress | ✅ Complete

### Phase 2A: Settings Page (45 min)
- [ ] Create file: `src/app/(protected)/settings/page.tsx` (server component)
- [ ] Server component:
  - [ ] Get current user from auth
  - [ ] Load user's profile from database
  - [ ] Get current preferred_provider value
  - [ ] Pass data to client component
- [ ] Create file: `src/app/(protected)/settings/page.tsx` OR create separate client component
- [ ] Client component includes:
  - [ ] Dropdown: Select preferred provider (Azure / OpenRouter)
  - [ ] Text input: Optional OpenRouter API key (for advanced users)
  - [ ] Save button: Submit preferences
  - [ ] Success message after save
- [ ] Server action: `updateStudentProvider(preferred_provider, api_key)`
  - [ ] Update profiles table for current user
  - [ ] Return success/error
- [ ] Test: Visit /settings page (or /dashboard/settings)
- [ ] Test: Change provider selection
- [ ] Test: Verify preference saved in database

### Phase 2B: Middleware Updates (15 min)
- [ ] Open `src/app/api/tutor/route.ts`
- [ ] Modify `determineProvider()` to read from database:
  ```
  SELECT preferred_provider FROM profiles WHERE id = userId
  ```
- [ ] Use stored preference instead of default
- [ ] Test: Student changes preference → API uses new provider
- [ ] Test: Student without preference → defaults to Azure

### Phase 2C: Admin Override (30 min)
- [ ] Extend admin dashboard component: `src/app/(protected)/admin/approvals/ApprovalsClient.tsx`
- [ ] Add column in user table: Display student's preferred_provider
- [ ] Add button or dropdown: Change student's provider
- [ ] Create server action: `adminUpdateStudentProvider(userId, newProvider)`
  - [ ] Verify admin is actually admin (is_admin = true)
  - [ ] Update student's preferred_provider
  - [ ] Log admin action
- [ ] Test: Admin changes student's provider
- [ ] Test: Student sees their new provider in settings
- [ ] Test: API uses admin-set provider

### Phase 2 Integration Testing
- [ ] Student views settings page
- [ ] Student changes provider preference
- [ ] Student sends correction
- [ ] Check logs: Correction used student's preferred provider
- [ ] Admin changes student's provider (override)
- [ ] Student sees new provider in settings
- [ ] Student sends correction
- [ ] Check logs: Correction used admin-set provider

### Phase 2 Sign-Off
- [ ] Settings page functional
- [ ] Student preferences saved and used
- [ ] Admin overrides work
- [ ] Date completed: _______________
- [ ] Ready for Phase 3: YES / NO

---

## PHASE 3: Fallback & Cost Tracking

**Status**: ⏳ Not Started | ⚠️ In Progress | ✅ Complete

### Phase 3A: Fallback Logic (30-45 min)
- [ ] Open `src/app/api/tutor/route.ts`
- [ ] Modify workflow call to include try/catch:
  ```
  try:
    Call primary provider workflow
    if success: return result
    if error: log error, continue to fallback
  catch:
    Log error
    Call fallback provider workflow
    if success: return result
    if error: return error to user
  ```
- [ ] Add env var: `DEFAULT_FALLBACK_PROVIDER=openrouter` (or azure)
- [ ] Test: Simulate primary provider failure
- [ ] Test: Verify fallback automatically used
- [ ] Test: Error message shown if both fail

### Phase 3B: Usage Logging (30-45 min)
- [ ] Create migration: `supabase/migrations/004_create_usage_logs_table.sql`
  ```sql
  CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    provider TEXT (azure | openrouter),
    content_type TEXT (text | audio | image),
    tokens_used INTEGER,
    cost NUMERIC(10,6),
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX idx_usage_logs_user ON usage_logs(user_id);
  CREATE INDEX idx_usage_logs_provider ON usage_logs(provider);
  ```
- [ ] Run: `supabase db push` (apply migration 004)
- [ ] Create utility: `src/lib/usage-logging.ts`
  - [ ] Function: `logUsage(userId, provider, contentType, tokensUsed, cost, success, errorMessage)`
  - [ ] Inserts into usage_logs table
- [ ] Modify `src/app/api/tutor/route.ts`:
  - [ ] After successful correction: Call logUsage()
  - [ ] If correction fails: Call logUsage() with error
- [ ] Test: Send 3-5 corrections with different providers
- [ ] Verify: usage_logs table populated with all attempts

### Phase 3C: Cost Tracking (optional)
- [ ] Extend admin dashboard with usage statistics
- [ ] Query usage_logs to show:
  - [ ] Total corrections per provider
  - [ ] Total cost per provider
  - [ ] Cost per student
  - [ ] Success/failure rates
- [ ] Add export button: Download usage_logs as CSV

### Phase 3 Integration Testing
- [ ] Stop/disable Azure service
- [ ] Send correction (should fallback to OpenRouter)
- [ ] Check usage_logs: Shows Azure attempt + OpenRouter success
- [ ] Re-enable Azure
- [ ] Send correction (should use Azure)
- [ ] Check usage_logs: Shows Azure success
- [ ] Verify costs calculated correctly in database

### Phase 3 Sign-Off
- [ ] Fallback logic working
- [ ] All usage logged to database
- [ ] Cost tracking operational
- [ ] Date completed: _______________
- [ ] Ready for Phase 4: YES / NO

---

## PHASE 4: Monitoring & Optimization

**Status**: ⏳ Not Started | ⚠️ In Progress | ✅ Complete

### Phase 4A: Rate Limiting (30-45 min)
- [ ] Create utility: `src/lib/rate-limiting.ts`
  - [ ] Track corrections per user per day
  - [ ] Limit: 50 corrections/day per student (configurable)
  - [ ] Return remaining count
- [ ] Modify `src/app/api/tutor/route.ts`:
  - [ ] Check rate limit before processing
  - [ ] If limit exceeded: Return 429 with message
  - [ ] If ok: Process and increment counter
- [ ] Test: Send 51 corrections in a day
- [ ] Verify: 51st returns 429 error
- [ ] Verify: Limit resets next day

### Phase 4B: Admin Controls (15-30 min)
- [ ] Extend admin dashboard:
  - [ ] Show current provider status (online/offline)
  - [ ] Button to disable provider (temporary outage)
  - [ ] Input: Max corrections per student (override default)
  - [ ] View real-time provider health
- [ ] Create server action: `adminToggleProvider(provider, enabled)`
- [ ] Modify `determineProvider()` to check disabled status
- [ ] If preferred disabled: Fall back to alternative
- [ ] Test: Disable Azure → corrections use OpenRouter
- [ ] Test: Re-enable Azure → back to normal

### Phase 4C: Monitoring (15 min)
- [ ] Add error tracking (e.g., Sentry)
  - [ ] Track API errors
  - [ ] Track n8n workflow failures
  - [ ] Track provider unavailability
- [ ] Create dashboard view:
  - [ ] Error rate per provider
  - [ ] Response time trends
  - [ ] User impact assessment
- [ ] Test: Trigger error, verify monitoring captures it

### Phase 4 Integration Testing
- [ ] Rate limiting prevents abuse (50 limit)
- [ ] Admin can disable provider temporarily
- [ ] Disabled provider → automatic fallback
- [ ] Error tracking captures all failures
- [ ] Admin sees real-time health stats

### Phase 4 Sign-Off
- [ ] Rate limiting working
- [ ] Admin controls functional
- [ ] Monitoring operational
- [ ] Date completed: _______________
- [ ] Production ready: YES / NO

---

## OVERALL PROJECT SUMMARY

### Completed Work
- [ ] Phase 0 Unblockers: ✅ (15-30 min)
- [ ] Phase 1 Foundation: ✅ (2.5-3 hrs)
- [ ] Phase 2 Student Config: ✅ (1.5-2 hrs)
- [ ] Phase 3 Fallback: ✅ (1.5-2 hrs)
- [ ] Phase 4 Monitoring: ✅ (1-1.5 hrs)

### Total Time Investment
- **MVP (Phases 0-3)**: 5.5-7.5 hours
- **Full (Phases 0-4)**: 6.5-9 hours

### Key Achievements
- [x] Single-provider → Multi-provider system
- [x] Azure + OpenRouter interchangeable
- [x] Student-configurable preferences
- [x] Automatic fallback on errors
- [x] Complete cost tracking
- [x] Rate limiting + admin controls
- [x] Monitoring + health checks

### Production Checklist
- [ ] All tests passing
- [ ] Error handling comprehensive
- [ ] Security reviewed
- [ ] Performance optimized
- [ ] Documentation complete
- [ ] Monitoring alerts configured
- [ ] Backup strategy defined
- [ ] Rollback plan documented

### Go-Live Readiness
- [ ] Phase 0: COMPLETE
- [ ] Phase 1: COMPLETE
- [ ] Phase 2: COMPLETE
- [ ] Phase 3: COMPLETE
- [ ] Phase 4: COMPLETE (if implementing)
- [ ] **READY FOR PRODUCTION**: YES / NO
- [ ] Go-live date: _______________

---

## QUICK REFERENCE: Current Phase

Today's date: _______________

**Current Phase**: 0 / 1 / 2 / 3 / 4

**What to do right now**:
1. ___________________________________
2. ___________________________________
3. ___________________________________

**Blockers/Issues**:
- ___________________________________
- ___________________________________

**Next check-in**: _______________

