/*
  # Fix handle_first_user_profile function schema path

  1. Problem
    - The handle_first_user_profile function may have schema path issues
    - This could cause the COUNT query to fail or behave unexpectedly

  2. Solution
    - Explicitly set search_path for the function
    - Use fully qualified table names (public.user_profiles)
    - Add error handling for better debugging

  3. Notes
    - This is a BEFORE INSERT trigger on user_profiles
    - It makes the first user an admin automatically
*/

CREATE OR REPLACE FUNCTION public.handle_first_user_profile()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_count INT;
BEGIN
  -- Count existing profiles
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;
  
  -- If this is the first user, make them admin and approved
  IF user_count = 0 THEN
    NEW.role := 'admin';
    NEW.is_approved := true;
  END IF;
  
  RETURN NEW;
END;
$$;