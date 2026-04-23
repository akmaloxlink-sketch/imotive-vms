/*
  # Add service role policy for user profile creation

  1. Changes
    - Adds a new RLS policy that allows service_role to insert profiles
    - This enables the handle_new_user() trigger to create profiles during signup
    - The trigger runs as SECURITY DEFINER but still needs an INSERT policy

  2. Security Notes
    - Only the service_role can use this policy (system-level operations)
    - Regular users still go through the "Users can insert own profile" policy
    - This is safe because triggers are controlled server-side code
*/

-- Allow service_role to insert profiles (for triggers)
CREATE POLICY "Service role can insert profiles"
  ON user_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);
