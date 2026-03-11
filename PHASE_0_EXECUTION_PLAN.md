# Phase 0: Step-by-Step Execution Plan

> Real-time execution guide with exact commands and steps

---

## STEP 1: Collect Credentials (5 minutes)

### What You Need to Do
1. Open `PHASE_0_CREDENTIALS_TEMPLATE.md`
2. For each of the 11 values, follow the "How to get" instructions
3. Write down all values
4. Verify using checklist at bottom of template

### Where to Get Each Value
| Credential | Source | Status |
|-----------|--------|--------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase Settings → API | Need to collect |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Settings → API | Need to collect |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Settings → API | Need to collect |
| N8N_WEBHOOK_BASE_URL | Local: `http://localhost:5678` | Default: localhost |
| N8N_WEBHOOK_SECRET | Generate random string | Need to generate |
| N8N_PASSWORD | Your n8n admin password | Need to set |
| AZURE_OPENAI_ENDPOINT | Azure Portal → Keys & Endpoint | Need to collect |
| AZURE_OPENAI_API_KEY | Azure Portal → Keys & Endpoint | Need to collect |
| AZURE_OPENAI_GPT_DEPLOYMENT | Azure OpenAI Studio → Deployments | Need to collect |
| AZURE_OPENAI_WHISPER_DEPLOYMENT | Azure OpenAI Studio → Deployments | Need to collect |
| NEXT_PUBLIC_APP_URL | Fixed | `http://localhost:3000` |

### Next Action
→ Collect all 11 values using the template  
→ Come back when ready to proceed

---

## STEP 2: Update .env.local (2 minutes)

**Status**: Ready to execute once you provide credentials

### What This Does
Replaces all placeholder values in `.env.local` with your real credentials

### Current Status of .env.local
```
File: C:\Users\Administrateur\Downloads\morodeutsch\.env.local
Status: ❌ Contains ALL PLACEHOLDER VALUES
Example content:
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ... (all 11 values are placeholders)
```

### After This Step
```
File: C:\Users\Administrateur\Downloads\morodeutsch\.env.local
Status: ✅ Contains REAL CREDENTIALS
Example content:
  NEXT_PUBLIC_SUPABASE_URL=https://abcdef123.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ... (all 11 values are real)
```

### Command to Test
```bash
npm run build
# Should complete WITHOUT "Missing environment variable" errors
```

### Next Action
→ Provide credentials from Step 1  
→ I'll update .env.local automatically  
→ You'll run the test command above

---

## STEP 3: Apply Database Migration 002 (5-10 minutes)

**Status**: Ready after Step 2

### What This Does
Adds 5 new columns to `profiles` table + creates 3 database indexes

### Columns Being Added
```sql
is_admin BOOLEAN DEFAULT false
approval_status TEXT DEFAULT 'pending' (values: pending, approved, rejected)
approved_at TIMESTAMPTZ DEFAULT NULL
rejection_reason TEXT DEFAULT NULL
signup_source TEXT DEFAULT 'web'
```

### Migration File
Location: `supabase/migrations/002_add_approval_flow.sql`  
Status: ✅ File exists and is correct

### How to Apply

**Option A: Using Supabase CLI (Recommended)**
```bash
# Step 1: Ensure .env.local is updated (from Step 2)
# Step 2: Link to Supabase project
supabase link

# Step 3: Push migration to database
supabase db push

# Step 4: Verify
supabase db list migrations
# Should show 001 and 002 as applied
```

**Option B: Manual SQL in Supabase Console**
```
1. Log into Supabase → Your Project
2. Go to SQL Editor
3. Open C:\Users\Administrateur\Downloads\morodeutsch\supabase\migrations\002_add_approval_flow.sql
4. Copy all SQL
5. Paste into SQL Editor
6. Click "Run"
7. Check for errors
```

### After This Step
Verify migration applied by running query:
```sql
SELECT COUNT(*) as column_count FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('approval_status', 'approved_at', 'rejection_reason', 'is_admin', 'signup_source');
-- Should return: 5
```

### Next Action
→ Run migration using Option A or B  
→ Verify query returns 5  
→ Proceed to Step 4

---

## STEP 4: Verify Profile Trigger (5 minutes)

**Status**: Ready after Step 3

### What This Does
Confirms that when users sign up, their profile gets `approval_status = 'pending'`

### Current Trigger Location
File: `supabase/migrations/001_initial_schema.sql`  
Function: `auth.handle_new_user()`

### How to Test

**Step 1: Start dev server**
```bash
npm run dev
# Should start without errors on localhost:3000
```

**Step 2: Create test user**
1. Go to http://localhost:3000/signup
2. Fill out form with test email (e.g., `test-trigger-check@example.com`)
3. Submit form
4. ✅ Should succeed without error

**Step 3: Check database**
```sql
SELECT id, email, approval_status FROM profiles 
WHERE email = 'test-trigger-check@example.com';
```

**Expected result:**
```
| id  | email | approval_status |
|-----|-------|-----------------|
| xxx | test... | pending |
```

### If approval_status is NULL or missing

**Fix (Option A: Update trigger in Supabase Console)**
```sql
CREATE OR REPLACE FUNCTION auth.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, approval_status, signup_source)
  VALUES (
    new.id,
    new.email,
    'pending',
    'web'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Fix (Option B: Create new migration)**
```bash
supabase migration new fix_auth_trigger_approval_status
# Add the UPDATE trigger code above
supabase db push
```

### After This Step
- ✅ New user signups have `approval_status = 'pending'`
- ✅ Trigger working correctly

### Next Action
→ Create test user and verify approval_status  
→ If NULL: Apply fix (Option A or B)  
→ Re-test with new user  
→ Proceed to Step 5

---

## STEP 5: Add Auth Callback Error Handling (10 minutes)

**Status**: Ready anytime

### What This Does
Adds error handling to catch issues when looking up user profile during OAuth callback

### Current File
Location: `src/app/auth/callback/route.ts`  
Lines: 25-38 (missing error handling)

### The Problem
If profile lookup fails, code silently defaults to approval-pending page instead of showing error

### The Fix
Replace lines 25-38 with error-aware code:

```typescript
// Check approval status to determine where to send the user
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('approval_status')
  .eq('id', user.id)
  .single();

// NEW: Check for profile lookup error
if (profileError) {
  console.error('Profile lookup failed:', profileError);
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

return NextResponse.redirect(`${origin}/approval-pending`);
```

### How to Apply
I'll do this automatically once Phase 0 starts

### After This Step
- ✅ Auth callback has error handling
- ✅ Profile lookup failures caught and logged
- ✅ User redirected to error page instead of silent failure

### Next Action
→ Apply fix automatically  
→ Proceed to Step 6

---

## STEP 6: Verify Admin Dashboard (5-15 minutes)

**Status**: Ready after Step 5

### What This Does
Confirms admin approval/rejection system is complete and working

### Files to Check
| File | Status | What it does |
|------|--------|------------|
| `src/app/(protected)/admin/approvals/page.tsx` | ✅ Exists | Server component that loads pending users |
| `src/app/(protected)/admin/approvals/ApprovalsClient.tsx` | ❓ Uncertain | Client component with UI for approve/reject |
| `src/app/(protected)/admin/actions.ts` | ❓ Uncertain | Server actions for approveUser/rejectUser |

### How to Test

**Step 1: Create test admin user**
```sql
-- In Supabase SQL Editor
UPDATE profiles 
SET is_admin = true, approval_status = 'approved'
WHERE id = '[your-test-user-id]';
```

**Step 2: Log in as admin**
1. Log out if logged in
2. Log in with admin user account
3. Should see dashboard with navigation

**Step 3: Visit admin dashboard**
1. Go to http://localhost:3000/admin/approvals
2. ✅ Page should load without errors
3. ✅ Should see list of pending users
4. ✅ Should see "Approve" and "Reject" buttons

**Step 4: Test approve functionality**
1. Find a pending user in list
2. Click "Approve" button
3. ✅ Should update approval_status in database
4. ✅ User can now log in and see dashboard

**Step 5: Test reject functionality**
1. Create another test user
2. Click "Reject" button
3. ✅ Should set approval_status = 'rejected'
4. ✅ User redirected to access-denied on login

### If Components Missing

**Check files**:
1. Does `ApprovalsClient.tsx` exist?
2. Does `actions.ts` exist?
3. Are server actions implemented?

**If missing**: Refer to ARCHITECTURE_GAPS_SUMMARY.md "Server Actions + Admin RLS Policy" section for complete implementation

### After This Step
- ✅ Admin dashboard loads
- ✅ Can see pending users
- ✅ Approve/reject functionality works
- ✅ Database updates correctly

### Next Action
→ Test admin dashboard  
→ Verify approve/reject work  
→ Proceed to Phase 0 sign-off

---

## PHASE 0 SIGN-OFF: Verification Tests (5-10 minutes)

**Status**: Ready after Steps 1-6

### Test 1: Build Succeeds
```bash
npm run build
# Should complete WITHOUT errors
# Check: No "Missing environment variable" errors
```

**Expected**: ✅ Build completes successfully

---

### Test 2: Signup Form Works
1. Go to http://localhost:3000/signup
2. Fill form with new test email
3. Submit
4. **Expected**: Form submits, email verification sent, profile created with `approval_status = 'pending'`
5. **Verify in Supabase**: `SELECT approval_status FROM profiles WHERE email = 'test@...'` → Returns 'pending'

---

### Test 3: Auth Callback Redirects Correctly
1. Create unapproved user (approval_status = 'pending')
2. Log in
3. **Expected**: Redirected to `/approval-pending`
4. **Verify**: Page loads without errors

---

### Test 4: Approved User Can Access Dashboard
1. Set test user `approval_status = 'approved'` in database
2. Log out and back in
3. **Expected**: Access granted to `/dashboard`
4. **Verify**: Dashboard loads without redirect

---

### Test 5: Rejected User Gets Denied
1. Create test user with `approval_status = 'rejected'`
2. Try to log in
3. **Expected**: Redirected to `/access-denied`
4. **Verify**: Cannot access protected routes

---

### Test 6: Admin Approval Works
1. Create admin user with `is_admin = true`
2. Log in as admin
3. Go to `/admin/approvals`
4. **Expected**: Pending users displayed
5. Click "Approve" on a pending user
6. **Expected**: User's status updated to 'approved'
7. **Verify**: User can now access dashboard

---

## Phase 0 Complete ✅

When all 6 tests pass:

- [ ] Test 1: Build succeeds
- [ ] Test 2: Signup form works, approval_status = 'pending'
- [ ] Test 3: Auth callback redirects to approval-pending
- [ ] Test 4: Approved user can access dashboard
- [ ] Test 5: Rejected user gets access-denied
- [ ] Test 6: Admin can approve/reject users

**Completion Date**: ________________

**Next Phase**: Phase 1 - Multi-Provider Foundation (2.5-3 hours)

---

## Timeline Summary

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | Collect credentials | 5 min | ⏳ Pending |
| 2 | Update .env.local | 2 min | ⏳ Ready |
| 3 | Apply migration 002 | 5-10 min | ⏳ Ready |
| 4 | Verify profile trigger | 5 min | ⏳ Ready |
| 5 | Add auth error handling | 10 min | ⏳ Ready |
| 6 | Verify admin dashboard | 5-15 min | ⏳ Ready |
| Tests | Run verification tests | 5-10 min | ⏳ Ready |
| **TOTAL** | **Phase 0 Complete** | **32-57 min** | ⏳ Pending |

---

## Next Action RIGHT NOW

**YOU**: Collect all 11 credentials using `PHASE_0_CREDENTIALS_TEMPLATE.md`

**THEN**: Come back and provide the values to Claude

**THEN**: Claude will update .env.local and guide you through remaining steps

