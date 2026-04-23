/*
  # Add Admin Delete Policy for User Management

  1. Changes
    - Add policy allowing admins to delete user profiles
    - This enables admins to reject/delete user requests
    
  2. Security
    - Policy checks that the user has role = 'admin'
    - Uses security definer function to avoid recursion
    - Admins cannot delete their own profile
*/

-- Allow admins to delete user profiles (for rejecting requests)
CREATE POLICY "Admins can delete profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    is_admin() AND id != auth.uid()
  );
