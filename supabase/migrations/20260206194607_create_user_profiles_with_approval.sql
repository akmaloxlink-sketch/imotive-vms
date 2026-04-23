/*
  # Create user profiles table with approval system

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, not null) - User email address
      - `fleet_account` (text, not null) - Fleet API username
      - `fleet_password` (text, not null) - Fleet API password for auto-login
      - `is_approved` (boolean, default false) - Whether user has been approved by admin
      - `role` (text, default 'user') - User role: 'user' or 'admin'
      - `approved_at` (timestamptz, nullable) - Timestamp when user was approved
      - `created_at` (timestamptz, default now()) - Registration timestamp

  2. Functions
    - `handle_first_user_profile()` - Automatically approves the first registered user as admin
    - `prevent_unauthorized_profile_changes()` - Prevents non-admin users from modifying role, is_approved, or approved_at fields

  3. Security
    - Enable RLS on `user_profiles` table
    - Users can read their own profile
    - Admin users can read all profiles
    - Users can insert their own profile (during registration)
    - Users can update their own profile (fleet credentials)
    - Admin users can update any profile (for approval management)

  4. Important Notes
    - The first user to register is automatically promoted to admin and approved
    - Non-admin users cannot escalate their own privileges via update
    - Fleet credentials are stored for automatic fleet API login after approval
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  fleet_account text NOT NULL,
  fleet_password text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'user',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION handle_first_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM user_profiles) = 0 THEN
    NEW.role := 'admin';
    NEW.is_approved := true;
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_profile_created
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_first_user_profile();

CREATE OR REPLACE FUNCTION prevent_unauthorized_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    NEW.role := OLD.role;
    NEW.is_approved := OLD.is_approved;
    NEW.approved_at := OLD.approved_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_profile_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unauthorized_profile_changes();

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
