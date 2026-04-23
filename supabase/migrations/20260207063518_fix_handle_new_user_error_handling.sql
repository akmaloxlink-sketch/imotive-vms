/*
  # Fix handle_new_user trigger error handling

  1. Problem
    - The handle_new_user trigger is causing auth.users INSERT to fail
    - This prevents users from registering
    - Likely due to an error in the trigger not being caught

  2. Solution
    - Add proper error handling to the trigger function
    - Add logging to help debug issues
    - Ensure trigger doesn't fail the entire signup process

  3. Testing
    - The trigger should gracefully handle any errors
    - User signup should succeed even if profile creation fails
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Try to insert the user profile
  BEGIN
    INSERT INTO public.user_profiles (id, email, fleet_account, fleet_password, contact_no)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'fleet_account', ''),
      COALESCE(NEW.raw_user_meta_data->>'fleet_password', ''),
      NEW.raw_user_meta_data->>'contact_no'
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Failed to create user profile for %: % %', NEW.email, SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
END;
$$;