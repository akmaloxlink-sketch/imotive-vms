/*
  # Fix Admin Policy Recursion Issue

  1. Changes
    - Drop the recursive admin policies
    - Create a security definer function to check admin status
    - Recreate admin policies using the helper function
    
  2. Security
    - Helper function bypasses RLS to avoid recursion
    - Policies still check that user is authenticated and has admin role
*/

-- Drop the recursive policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Allow admins to read all user profiles
CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Allow admins to update any user profile (for approval/revoke)
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
