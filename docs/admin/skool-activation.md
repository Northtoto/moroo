# Skool Member Activation — Admin Workflow

## Overview

Users pay in the Skool community "marodeutsh". To grant them premium access on morodeutsh.com, follow one of these methods.

## Method 1: Zapier (automated, Skool Pro plan required)

Set up a Zapier automation:
- Trigger: Skool → New Paid Member
- Action: Webhooks by Zapier → POST
  - URL: `https://morodeutsch.com/api/skool/verify`
  - Payload:
    ```json
    {
      "email": "{{email}}",
      "secret": "<SKOOL_WEBHOOK_SECRET value>",
      "granted_by": "zapier"
    }
    ```

The endpoint is idempotent — safe to trigger multiple times for the same email.

## Method 2: Single email (admin CLI)

```bash
curl -X POST https://morodeutsch.com/api/skool/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.com","secret":"<SKOOL_WEBHOOK_SECRET>","granted_by":"admin"}'
```

Response:
- `{"status":"pre_authorized"}` — user hasn't signed up yet, will get premium at signup
- `{"status":"upgraded"}` — existing user upgraded immediately

## Method 3: CSV bulk import (Supabase SQL Editor)

Export member emails from Skool admin → paste into Supabase SQL Editor:

```sql
INSERT INTO skool_verified_emails (email, granted_by)
VALUES
  ('member1@example.com', 'csv_import'),
  ('member2@example.com', 'csv_import')
ON CONFLICT (email) DO NOTHING;

-- Upgrade already-registered users immediately:
UPDATE subscriptions s
SET tier = 'premium', status = 'active', updated_at = now()
FROM profiles p
WHERE p.id = s.user_id
  AND lower(p.email) IN (SELECT lower(email) FROM skool_verified_emails)
  AND s.tier != 'premium';

UPDATE profiles
SET skool_member = true, skool_verified_at = now(), signup_source = 'skool'
WHERE lower(email) IN (SELECT lower(email) FROM skool_verified_emails)
  AND skool_member = false;
```

## Revoking access

Skool has no revocation webhook. To revoke a member:

```sql
-- Downgrade subscription
UPDATE subscriptions SET tier = 'free', status = 'inactive' WHERE user_id = '<user_id>';
-- Mark profile
UPDATE profiles SET skool_member = false WHERE id = '<user_id>';
```

Or use the Supabase dashboard: Table Editor → subscriptions → find by user_id → edit row.

## Verification

After activating, verify the user has premium:
```sql
SELECT p.email, p.skool_member, s.tier, s.status
FROM profiles p
JOIN subscriptions s ON s.user_id = p.id
WHERE p.email = 'member@example.com';
```
Expected: `skool_member = true`, `tier = premium`, `status = active`.
