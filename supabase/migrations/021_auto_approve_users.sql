-- Migration 021: Auto-approve all users on signup
-- Context: The app was in invite-only/beta mode requiring manual approval.
--          For open launch, all new users should be approved immediately.
--          This migration changes the column default and approves existing pending users.

-- 1. Change default so all future signups are auto-approved
ALTER TABLE profiles
  ALTER COLUMN approval_status SET DEFAULT 'approved';

-- 2. Approve all currently pending users (no one gets stuck in approval limbo)
UPDATE profiles
SET approval_status = 'approved'
WHERE approval_status = 'pending';
