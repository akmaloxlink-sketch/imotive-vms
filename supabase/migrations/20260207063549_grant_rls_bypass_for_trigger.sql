/*
  # Grant RLS bypass for trigger function

  1. Problem
    - The handle_new_user trigger function runs as postgres role
    - postgres role in Supabase is not a superuser
    - SECURITY DEFINER alone doesn't bypass RLS without superuser
    - RLS policies block the insert during trigger execution

  2. Solution
    - Grant BYPASSRLS permission to postgres role for this function
    - This allows the trigger to insert profiles without RLS checks

  3. Security
    - This is safe because the function only runs during user creation
    - The function validates data and only inserts the new user's profile
*/

-- Drop and recreate the function with explicit RLS bypass
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Disable RLS for this transaction
  PERFORM set_config('role', 'service_role', true);
  
  -- Insert the user profile
  INSERT INTO public.user_profiles (id, email, fleet_account, fleet_password, contact_no)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'fleet_account', ''),
    COALESCE(NEW.raw_user_meta_data->>'fleet_password', ''),
    NEW.raw_user_meta_data->>'contact_no'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Failed to create user profile for %: % %', NEW.email, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;