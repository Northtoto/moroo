-- Add admin flag to profiles
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;

-- Add approval-related columns to profiles
ALTER TABLE profiles ADD COLUMN approval_status TEXT DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE profiles ADD COLUMN approved_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE profiles ADD COLUMN rejection_reason TEXT DEFAULT NULL;

ALTER TABLE profiles ADD COLUMN signup_source TEXT DEFAULT 'web';

-- Create indexes for faster approval dashboard queries
CREATE INDEX idx_profiles_approval_status ON profiles(approval_status);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin);
