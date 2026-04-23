/*
  # Fix user_profiles RLS policy recursion
  
  1. Problem
    - Existing admin policies create recursive queries
    - Checking if user is admin requires reading user_profiles
    - This causes infinite loop and policy conflict error (42P17)
  
  2. Solution
    - Drop the recursive admin policies
    - Keep simple user policies for reading/updating own profile
    - Admin checks will happen at application level
  
  3. Security
    - Users can only read and update their own profile
    - Profile creation handled by trigger (service role)
    - No data exposure risk
*/

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Admin can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON user_profiles;

-- Keep the simple, non-recursive policies
-- These are already in place and working correctly:
-- 1. "Users can read own profile" - allows SELECT where auth.uid() = id
-- 2. "Users can update own profile" - allows UPDATE where auth.uid() = id
-- 3. "Users can insert own profile" - allows INSERT where auth.uid() = id
-- 4. "Service role can insert profiles" - allows trigger to create profiles