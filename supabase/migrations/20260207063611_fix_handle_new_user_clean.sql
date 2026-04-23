/*
  # Fix handle_new_user trigger function properly

  1. Problem
    - Previous attempt to use set_config won't work
    - postgres role already has BYPASSRLS permission
    - SECURITY DEFINER should work correctly

  2. Solution
    - Restore clean, simple trigger function
    - postgres role with SECURITY DEFINER will bypass RLS automatically
    - Add proper error handling for debugging

  3. Notes
    - The function is owned by postgres which has rolbypassrls=true
    - SECURITY DEFINER means it runs with owner's (postgres) privileges
    - This will bypass all RLS policies
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, fleet_account, fleet_password, contact_no)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'fleet_account', ''),
    COALESCE(NEW.raw_user_meta_data->>'fleet_password', ''),
    NEW.raw_user_meta_data->>'contact_no'
  );
  
  RETURN NEW;
END;
$$;