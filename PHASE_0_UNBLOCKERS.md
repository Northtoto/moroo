# Phase 0: Critical Unblockers

> **Status**: 🔴 CRITICAL - Platform blocked until all Phase 0 items complete
> 
> **Timeline**: 15-30 minutes (mostly credential setup)
> 
> **Prerequisites**: Supabase project created, n8n running, Azure credentials configured

---

## BLOCKER #1: Environment Variables (CRITICAL - All database operations blocked)

### Current State
- ✅ `.env.example` exists with correct variable names
- ❌ `.env.local` contains **ALL PLACEHOLDER VALUES**
- ❌ No real credentials configured anywhere
- **Impact**: Platform cannot connect to Supabase, n8n, or Azure

### Required Values (Get from appropriate services)

#### Supabase Credentials
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```
**How to get:**
1. Go to Supabase project settings → API
2. Copy URL, anon key, and service role key
3. Paste into .env.local

#### n8n Webhook Credentials
```
N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=[generate-secure-random-string]
N8N_PASSWORD=[your-n8n-admin-password]
```
**How to get:**
1. Start n8n: `npm run dev:n8n`
2. Visit http://localhost:5678 and set admin password
3. N8N_WEBHOOK_SECRET: Generate random string (32 chars recommended)
4. N8N_WEBHOOK_BASE_URL: Should be localhost:5678 for development

#### Azure OpenAI Credentials
```
AZURE_OPENAI_ENDPOINT=https://[resource-name].openai.azure.com/
AZURE_OPENAI_API_KEY=[your-api-key]
AZURE_OPENAI_GPT_DEPLOYMENT=gpt-5.2
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```
**How to get:**
1. Go to Azure OpenAI Studio
2. Find your resource
3. Copy endpoint URL and API key
4. Verify deployment names match (gpt-5.2 and whisper)

#### App Configuration
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
(Keep as-is for development)

### Action Required
**Before proceeding, populate .env.local with REAL credentials from your services.**

---

## BLOCKER #2: Database Migration 002 Not Applied (Approval Flow Tables)

### Current State
- ✅ Migration file exists: `supabase/migrations/002_add_approval_flow.sql`
- ✅ Migration is correctly formatted (PostgreSQL syntax verified)
- ❌ Migration NOT applied to Supabase database (pending real credentials)
- **Impact**: Approval system won't work; columns missing from database

### Migration Details

**Adds 5 columns to profiles table:**
```sql
is_admin BOOLEAN DEFAULT false
approval_status TEXT DEFAULT 'pending' (check: pending|approved|rejected)
approved_at TIMESTAMPTZ DEFAULT NULL
rejection_reason TEXT DEFAULT NULL
signup_source TEXT DEFAULT 'web'
```

**Creates 3 indexes:**
- `idx_profiles_approval_status` (for approval dashboard queries)
- `idx_profiles_created_at DESC` (for recent signup listing)
- `idx_profiles_is_admin` (for admin checks)

### Action Required

**Option A: Using Supabase CLI (Recommended)**
```bash
# 1. Set credentials in .env.local first (BLOCKER #1)
# 2. Link to Supabase project
supabase link

# 3. Push migration to database
supabase db push

# 4. Verify migration applied
supabase db list migrations
```

**Option B: Manual SQL in Supabase Console**
1. Log into Supabase project
2. Go to SQL Editor
3. Copy all SQL from `supabase/migrations/002_add_approval_flow.sql`
4. Paste and execute
5. Verify all 5 columns exist in profiles table

**Verification Query:**
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('approval_status', 'approved_at', 'rejection_reason', 'is_admin', 'signup_source')
ORDER BY column_name;
-- Should return 5 rows
```

---

## BLOCKER #3: Profile Trigger May Not Set approval_status

### Current State
- ✅ Auth trigger auto-creates profile on signup
- ❓ Unknown if trigger sets `approval_status = 'pending'`
- **Impact**: New users might not have approval_status set, causing errors

### Migration 001 Trigger Code
Located in `supabase/migrations/001_initial_schema.sql`, look for:
```sql
CREATE OR REPLACE FUNCTION auth.handle_new_user()
```

### What It Should Do
When user signs up, trigger should:
1. Create profile record
2. Set `approval_status = 'pending'` (NEW FIELD from Migration 002)
3. Set `subscription_tier = 'free'` (existing)
4. Set `signup_source = 'web'` (existing - NEW in Migration 002)

### How to Verify
1. Create test account via `/signup` form
2. In Supabase console, query: `SELECT id, email, approval_status FROM profiles WHERE email = 'test@example.com'`
3. If `approval_status` is NULL, trigger needs fixing

### How to Fix (If Needed)
**Option A: Update trigger in Supabase Console**
```sql
-- Update existing trigger to set approval_status
CREATE OR REPLACE FUNCTION auth.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, approval_status, signup_source)
  VALUES (
    new.id,
    new.email,
    'pending',  -- NEW: Set approval status
    'web'       -- signup source
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Option B: Create new migration to fix trigger**
```bash
# Create migration file
supabase migration new fix_auth_trigger_approval_status
# Add the UPDATE trigger code
# Push: supabase db push
```

---

## ISSUE #4: Auth Callback Missing Error Handling

### Current State
- ✅ Auth callback checks `approval_status`
- ⚠️ **Missing**: Error handling for profile lookup failure
- ⚠️ **Missing**: Error message if profile doesn't exist
- **Impact**: If profile lookup fails (e.g., trigger didn't run), user sees blank page

### Current Code Location
`src/app/auth/callback/route.ts` (lines 25-30)

```typescript
// Current - missing error handling
const { data: profile } = await supabase
  .from('profiles')
  .select('approval_status')
  .eq('id', user.id)
  .single();

if (profile?.approval_status === 'approved') {
  return NextResponse.redirect(`${origin}/dashboard`);
}
```

### Issue
If profile doesn't exist, `profile` is null, and code defaults to approval-pending silently.

### How to Fix
Add error handling in auth callback:

```typescript
// src/app/auth/callback/route.ts - Replace lines 25-38

// Check approval status to determine where to send the user
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('approval_status')
  .eq('id', user.id)
  .single();

// NEW: Check for profile lookup error
if (profileError) {
  console.error('Profile lookup failed:', profileError);
  // Log this event - something went wrong with profile trigger
  return NextResponse.redirect(`${origin}/login?error=profile_not_found`);
}

// NEW: Check if profile exists
if (!profile) {
  console.error('Profile not found for user:', user.id);
  return NextResponse.redirect(`${origin}/login?error=profile_not_found`);
}

if (profile.approval_status === 'approved') {
  return NextResponse.redirect(`${origin}/dashboard`);
}

if (profile.approval_status === 'rejected') {
  return NextResponse.redirect(`${origin}/access-denied?reason=rejected`);
}

// Default: pending approval
return NextResponse.redirect(`${origin}/approval-pending`);
```

---

## ISSUE #5: Admin Dashboard Incomplete

### Current State
- ✅ Server component exists: `src/app/(protected)/admin/approvals/page.tsx` (90 lines)
- ❌ **Uncertain**: Client component `ApprovalsClient.tsx` may be missing or incomplete
- ⚠️ **Unknown**: Server actions for approve/reject may not be implemented
- **Impact**: Admin can't approve users; no access control on admin routes

### Required Components

#### 1. Server Actions - `src/app/(protected)/admin/actions.ts`
Should contain three server actions:
- `approveUser(profileId: string)` - Set approval_status = 'approved'
- `rejectUser(profileId: string, reason: string)` - Set approval_status = 'rejected'
- `getPendingProfiles()` - Fetch all pending approval users

These must:
1. Verify user is authenticated
2. Verify user has `is_admin = true`
3. Use service-role client to bypass RLS
4. Update profiles table

#### 2. Server Component - `src/app/(protected)/admin/approvals/page.tsx`
Should:
1. Verify user is admin
2. Load pending profiles
3. Pass data to client component
4. Handle loading/error states

#### 3. Client Component - `src/app/(protected)/admin/approvals/ApprovalsClient.tsx`
Should:
1. Display pending users in table or list
2. Show: email, full_name, signup date
3. Provide "Approve" and "Reject" buttons
4. Call server actions on button click
5. Show loading states during approval
6. Refresh data after approval

### How to Verify
1. Log in as admin user (set `is_admin = true` manually in database)
2. Visit http://localhost:3000/admin/approvals
3. Check if:
   - Page loads without error
   - Pending users display
   - Approve/Reject buttons work
   - Approval updates database

### How to Fix (If Missing)
See `ARCHITECTURE_GAPS_SUMMARY.md` section "Server Actions + Admin RLS Policy" for complete implementation of admin approve/reject system.

---

## TESTING CHECKLIST: Phase 0 Complete

After fixing all unblockers above, verify platform is functional:

### ✅ Test 1: Environment Connection
```bash
# Run this in project root
npm run build
# Should complete without "Missing environment variable" errors
```

### ✅ Test 2: Supabase Connection
1. Start dev server: `npm run dev`
2. Visit http://localhost:3000
3. Click "Sign Up"
4. Fill form with test email
5. **Expected**: Form submits without error, verification email sent
6. **Check**: New profile appears in Supabase with `approval_status = 'pending'`

### ✅ Test 3: Auth Flow
1. Open verification email link (in Supabase Auth tests)
2. **Expected**: Redirected to `/approval-pending`
3. **Check**: Profile shows `approved_at = NULL` in database

### ✅ Test 4: Admin Approval
1. Set test user `approval_status = 'approved'` manually in database
2. Log out and back in
3. **Expected**: Can access `/dashboard`
4. **Check**: Middleware allows access (no redirect to /approval-pending)

### ✅ Test 5: Rejection
1. Create second test user with `approval_status = 'rejected'`
2. Try to log in as that user
3. **Expected**: Redirected to `/access-denied`
4. **Check**: Cannot access any protected routes

### ✅ Test 6: Admin Routes
1. Create admin user with `is_admin = true`
2. Log in as admin
3. Visit `/admin/approvals`
4. **Expected**: Dashboard loads, shows pending users
5. **Check**: Can approve/reject users from dashboard

---

## PHASE 0 COMPLETION CRITERIA

- [ ] **BLOCKER #1**: .env.local populated with real credentials (not placeholders)
- [ ] **BLOCKER #2**: Migration 002 applied to Supabase database
- [ ] **BLOCKER #3**: Profile trigger verified to set approval_status = 'pending'
- [ ] **ISSUE #4**: Auth callback error handling added
- [ ] **ISSUE #5**: Admin approve/reject system verified working
- [ ] **All tests pass**: Can signup, approve users, access dashboard

---

## NEXT STEP AFTER PHASE 0

Once Phase 0 complete, proceed with:
- **Phase 1A**: Add OpenRouter environment variables and database columns
- **Phase 1B**: Create OpenRouter n8n workflows (3 new workflows)
- **Phase 1C**: Update API route to support provider selection
- **Phase 2**: Student provider configuration UI

See `ARCHITECTURE_GAPS_SUMMARY.md` for full implementation roadmap.

---

## QUICK REFERENCE: File Locations

| Item | Location | Status |
|------|----------|--------|
| Environment template | `.env.example` | ✅ Exists |
| Environment actual | `.env.local` | ❌ Placeholder values |
| Migration 001 (initial) | `supabase/migrations/001_initial_schema.sql` | ✅ Applied |
| Migration 002 (approval) | `supabase/migrations/002_add_approval_flow.sql` | ⚠️ Not applied |
| Auth callback | `src/app/auth/callback/route.ts` | ⚠️ Missing error handling |
| Admin approvals server | `src/app/(protected)/admin/approvals/page.tsx` | ⚠️ Uncertain |
| Admin client component | `src/app/(protected)/admin/approvals/ApprovalsClient.tsx` | ❌ May be missing |
| Admin server actions | `src/app/(protected)/admin/actions.ts` | ⚠️ Uncertain |
| Signup page | `src/app/(auth)/signup/page.tsx` | ✅ Complete |
| Approval pending page | `src/app/(auth)/approval-pending/page.tsx` | ✅ Complete |
| Access denied page | `src/app/(auth)/access-denied/page.tsx` | ✅ Complete |

