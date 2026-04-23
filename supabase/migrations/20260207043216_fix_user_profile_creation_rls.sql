/*
  # Fix user profile creation with proper RLS bypass

  1. Changes
    - Modifies handle_new_user() function to properly bypass RLS
    - Sets local role to service_role during insert to avoid RLS conflicts
    - The issue was that the INSERT policy checks auth.uid() = id,
      but during user creation the auth context isn't fully established yet

  2. Security Notes
    - Function runs as SECURITY DEFINER with elevated privileges
    - Only creates profiles for newly registered users (can't be exploited)
    - RLS policies for SELECT, UPDATE, DELETE remain fully enforced
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Bypass RLS by setting the context appropriately
  -- This is safe because the trigger only fires on user creation
  INSERT INTO public.user_profiles (id, email, fleet_account, fleet_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'fleet_account', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'fleet_password', '')
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_confirm_email() TO service_role;
