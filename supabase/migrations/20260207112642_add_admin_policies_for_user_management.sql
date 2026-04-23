/*
  # Add Admin Policies for User Management

  1. Changes
    - Add policy allowing admins to read all user profiles
    - Add policy allowing admins to update any user profile (for approval/revoke)
    
  2. Security
    - Policies check that the user has role = 'admin'
    - This enables admin users to view and manage all users in the system
*/

-- Allow admins to read all user profiles
CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update any user profile (for approval/revoke)
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
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
