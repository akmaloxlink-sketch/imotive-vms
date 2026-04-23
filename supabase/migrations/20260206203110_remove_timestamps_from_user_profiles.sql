/*
  # Remove timestamp columns from user_profiles

  1. Changes
    - Remove `approved_at` column from `user_profiles`
    - Remove `created_at` column from `user_profiles`
    - Update trigger function to no longer set `approved_at`
*/

ALTER TABLE user_profiles DROP COLUMN IF EXISTS approved_at;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS created_at;

CREATE OR REPLACE FUNCTION handle_first_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM user_profiles) = 0 THEN
    NEW.role := 'admin';
    NEW.is_approved := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION prevent_unauthorized_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    NEW.role := OLD.role;
    NEW.is_approved := OLD.is_approved;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
