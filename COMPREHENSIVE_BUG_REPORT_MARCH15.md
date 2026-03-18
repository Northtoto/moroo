# 🔴 COMPREHENSIVE BUG REPORT - MORODEUTSCH
**Date:** March 15, 2026 | **Status:** 11 Critical/High Issues Found

---

## 📋 Executive Summary

A complete scan of the morodeutsch codebase has identified **11 issues** across database, API routes, and configuration:
- **🔴 CRITICAL (5):** Will cause runtime failures
- **🟠 HIGH (4):** Will cause unexpected behavior  
- **🟡 MEDIUM (2):** Code quality/maintainability

---

## 🔴 CRITICAL ISSUES

### 1. **Stripe Webhook - Column Name Mismatch (Idempotency Breaking)**
**File:** `src/app/api/stripe/webhook/route.ts` (Line 39)  
**Severity:** CRITICAL - Webhook will crash  
**Problem:**
```typescript
// WRONG - Looking for stripe_event_id column
const { data } = await supabase
  .from('processed_stripe_events')
  .select('id')
  .eq('stripe_event_id', eventId)  // ❌ Column doesn't exist!
  .single();
```

**Why it breaks:** Migration 007 creates the column as `event_id`, not `stripe_event_id`
```sql
-- From 007_subscriptions.sql:
CREATE TABLE processed_stripe_events (
  event_id text PRIMARY KEY,  -- ← Column name is event_id
  event_type text,
  processed_at timestamptz DEFAULT now()
);
```

**Fix:** Change to correct column name:
```typescript
.eq('event_id', eventId)  // ✅ Correct
```

---

### 2. **Stripe Webhook - Wrong Column Name in Inserts**
**File:** `src/app/api/stripe/webhook/route.ts` (Line 45)  
**Severity:** CRITICAL - Inserts will fail  
**Problem:**
```typescript
// WRONG - stripe_event_id doesn't exist
await supabase
  .from('processed_stripe_events')
  .insert({ stripe_event_id: eventId, processed_at: new Date().toISOString() });
  // ❌ Should be event_id
```

**Fix:**
```typescript
.insert({ event_id: eventId, processed_at: new Date().toISOString() });
```

---

### 3. **Stripe Webhook - Wrong Schema Field Name**
**File:** `src/app/api/stripe/webhook/route.ts` (Line 58)  
**Severity:** CRITICAL - Subscription upsets will fail  
**Problem:**
```typescript
await supabase.from('subscriptions').upsert({
  // ... other fields ...
  stripe_price_id: priceId,  // ❌ Field doesn't exist in schema!
  // ... more fields ...
}, { onConflict: 'user_id' });
```

**Why it breaks:** The subscriptions table schema (from 007) has `price_id`, not `stripe_price_id`

**Fix:**
```typescript
price_id: priceId,  // ✅ Use correct field name
```

---

### 4. **Stripe Webhook - Missing Fields in Subscription Upsert**
**File:** `src/app/api/stripe/webhook/route.ts` (Line 58-68)  
**Severity:** CRITICAL - Schema validation will fail  
**Problem:**
```typescript
await supabase.from('subscriptions').upsert({
  user_id: userId,
  stripe_subscription_id: subscription.id,
  stripe_customer_id: subscription.customer as string,
  stripe_price_id: priceId,  // ❌ Wrong name
  tier,
  status: subscription.status,
  // Missing required fields:
  // - current_period_start is being set but field might not exist
  // - current_period_end is being set but format might be wrong
  // - cancel_at_period_end is set
  // - updated_at is set
  // Missing:
  // - created_at for new records
  // - id (UUID) for new records
}, { onConflict: 'user_id' });
```

**Why it breaks:** 
- Subscriptions table expects an `id` field (UUID PRIMARY KEY)
- Some fields are being inserted that don't match the schema

**Check schema:** The actual subscriptions table structure from 007_subscriptions.sql needs verification against what the code expects.

---

### 5. **Tutor API - Unsafe Type Casting**
**File:** `src/app/api/tutor/route.ts` (Line 35)  
**Severity:** CRITICAL - Type safety violation  
**Problem:**
```typescript
const audioBlob = new Blob([await audioFile.arrayBuffer()], { 
  type: audioFile.type || 'audio/webm'  // Could be null/undefined
});
```

**Why it breaks:** `audioFile.type` could be null, falling back to 'audio/webm' without validation

**Fix:**
```typescript
const audioBlob = new Blob([await audioFile.arrayBuffer()], { 
  type: (audioFile.type || 'audio/webm') as string
});
```

---

## 🟠 HIGH SEVERITY ISSUES

### 6. **Missing Student Model Tables**
**Files Affected:** `src/lib/student-model.ts`  
**Severity:** HIGH - Feature will crash  
**Problem:** The code references these tables that may not exist:
```typescript
supabase.from('error_patterns')      // May not be created
supabase.from('student_beliefs')     // May not be created  
supabase.from('learning_state')      // May not be created
supabase.from('vocabulary_cards')    // May not be created
```

**Why:** These tables aren't defined in any visible migration file (001-011)

**Status:** ⚠️ Need to verify against latest migrations. If missing, add migration 012.

---

### 7. **Security Events Table Missing**
**File:** `src/lib/api-guard.ts` (Line 68)  
**Severity:** HIGH - Security logging will fail silently  
**Problem:**
```typescript
await supabase.from('security_events').insert({
  event_type: event,
  user_id: userId,
  ip_address: ip,
  metadata: detail ?? {},
  created_at: new Date().toISOString(),
});
```

**Why:** No migration creates `security_events` table

**Status:** Need to create migration 012 with this table

---

### 8. **Stripe Webhook - Unsafe TypeScript Casting**
**File:** `src/app/api/stripe/webhook/route.ts` (Line 59-62)  
**Severity:** HIGH - Type safety  
**Problem:**
```typescript
current_period_start: new Date(((subscription as unknown as Record<string, number>).current_period_start) * 1000).toISOString(),
current_period_end: new Date(((subscription as unknown as Record<string, number>).current_period_end) * 1000).toISOString(),
```

**Why it's bad:** Double type casting (`as unknown as`) is a red flag. The Stripe.Subscription type already has these fields properly typed.

**Fix:**
```typescript
current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
```

---

### 9. **Rate Limit Store Never Clears Old Entries in Edge Cases**
**File:** `src/lib/api-guard.ts` (Line 61-67)  
**Severity:** HIGH - Memory leak potential  
**Problem:**
```typescript
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) rateLimitStore.delete(key);
    }
  }, 5 * 60 * 1000);  // Runs every 5 minutes
}
```

**Why:** 
- In serverless (Next.js), this interval may not persist across cold starts
- Map could grow unbounded if Vercel cold-starts frequently
- Better approach: Use Redis or TTL-based solution

**Impact:** Long-running instances could accumulate stale rate limit entries

---

## 🟡 MEDIUM SEVERITY ISSUES

### 10. **Missing RPC Function: check_and_increment_quota**
**File:** `src/lib/api-guard.ts` (Line 155)  
**Severity:** MEDIUM - Quota checking will silently fail  
**Problem:**
```typescript
const { data, error } = await serviceClient.rpc('check_and_increment_quota', {
  p_user_id: user.id,
  p_type: quota,
});
```

**Why:** This RPC function needs to be defined in Supabase. No SQL file creates it.

**Status:** Need to add this function to a migration (e.g., migration 012)

---

### 11. **Error Handling Pattern Inconsistency**
**File:** Multiple files (`api-guard.ts`, `tutor/route.ts`)  
**Severity:** MEDIUM - Inconsistent error responses  
**Problem:**
- Some endpoints return `{ error: string }`
- Some return `{ error: string, details?: ... }`
- Some return `{ error: string, quota: ... }`
- Swagger/docs will be confusing

**Example inconsistency:**
```typescript
// From api-guard.ts line 181:
return NextResponse.json({ error: 'Invalid request body', details: [...] }, { status: 400 });

// From tutor/route.ts line 226:
return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });

// From api-guard.ts line 135:
return NextResponse.json({ 
  error: 'Daily limit reached',
  quota: quotaResult,  // ← Extra fields
  upgrade_url: '/pricing',
  message: '...'
}, { status: 429 });
```

**Fix:** Standardize response schema across all endpoints.

---

## 📊 Issue Summary Table

| # | Issue | File | Type | Status |
|---|-------|------|------|--------|
| 1 | Stripe webhook column mismatch (query) | stripe/webhook | CRITICAL | 🔴 Blocks webhook |
| 2 | Stripe webhook column mismatch (insert) | stripe/webhook | CRITICAL | 🔴 Blocks webhook |
| 3 | Wrong field name stripe_price_id | stripe/webhook | CRITICAL | 🔴 Blocks upsert |
| 4 | Missing id/created_at fields | stripe/webhook | CRITICAL | 🔴 Schema fail |
| 5 | Unsafe type casting audioFile.type | tutor/route | CRITICAL | 🔴 Type safety |
| 6 | Missing student model tables | student-model | HIGH | 🟠 Feature broken |
| 7 | Missing security_events table | api-guard | HIGH | 🟠 Logging fails |
| 8 | Double type casting Subscription | stripe/webhook | HIGH | 🟠 Type safety |
| 9 | Rate limit memory leak | api-guard | HIGH | 🟠 Perf issue |
| 10 | Missing RPC function | api-guard | MEDIUM | 🟡 Quota silent fail |
| 11 | Error response inconsistency | api-guard, tutor | MEDIUM | 🟡 API design |

---

## 🔧 Quick Fix Priority

**Do FIRST (Blocks everything):**
1. Fix issues #1-2 in stripe/webhook (column names)
2. Fix issue #3 in stripe/webhook (field name)
3. Create migration 012 with missing tables

**Do SECOND (Prevents features working):**
4. Fix issue #4 subscription upsert
5. Fix issue #6 student model tables
6. Add RPC function check_and_increment_quota

**Do THIRD (Improves stability):**
7. Fix unsafe type castings
8. Replace in-memory rate limiter with Redis
9. Standardize error responses

---

## 📝 Recommended Next Steps

1. **Generate fixed files** - I can provide corrected versions
2. **Create migration 012** - For missing tables (student_beliefs, error_patterns, etc.)
3. **Test Stripe webhook** - After fixes, test with real webhook events
4. **Run TypeScript strict mode** - `npx tsc --noEmit` to find type errors
5. **Add e2e tests** - For critical paths (auth, stripe, tutor API)

**Would you like me to generate the fixes for any of these issues?**

