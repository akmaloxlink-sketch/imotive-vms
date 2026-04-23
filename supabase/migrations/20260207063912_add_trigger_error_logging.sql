/*
  # Add comprehensive error logging to triggers

  1. Purpose
    - Add detailed error logging to help debug signup failures
    - Catch and log specific errors that occur during profile creation

  2. Changes
    - Update handle_new_user to log errors without failing signup
    - Update handle_first_user_profile to include error handling
    - Errors will be logged as WARNINGS visible in database logs
*/

-- Update handle_new_user with detailed error logging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_fleet_account text;
  v_fleet_password text;
  v_contact_no text;
BEGIN
  -- Extract metadata with logging
  v_fleet_account := COALESCE(NEW.raw_user_meta_data->>'fleet_account', '');
  v_fleet_password := COALESCE(NEW.raw_user_meta_data->>'fleet_password', '');
  v_contact_no := NEW.raw_user_meta_data->>'contact_no';
  
  RAISE NOTICE 'handle_new_user: Creating profile for user % with fleet_account=%', NEW.email, v_fleet_account;
  
  -- Try to insert the user profile
  BEGIN
    INSERT INTO public.user_profiles (id, email, fleet_account, fleet_password, contact_no)
    VALUES (NEW.id, NEW.email, v_fleet_account, v_fleet_password, v_contact_no);
    
    RAISE NOTICE 'handle_new_user: Successfully created profile for %', NEW.email;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: Failed to create profile for %: SQLSTATE=%, SQLERRM=%', 
        NEW.email, SQLSTATE, SQLERRM;
      -- Don't fail the signup, just log the error
  END;
  
  RETURN NEW;
END;
$$;

-- Update handle_first_user_profile with error handling
CREATE OR REPLACE FUNCTION public.handle_first_user_profile()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_count INT;
BEGIN
  BEGIN
    -- Count existing profiles
    SELECT COUNT(*) INTO user_count FROM public.user_profiles;
    
    RAISE NOTICE 'handle_first_user_profile: user_count=%', user_count;
    
    -- If this is the first user, make them admin and approved
    IF user_count = 0 THEN
      NEW.role := 'admin';
      NEW.is_approved := true;
      RAISE NOTICE 'handle_first_user_profile: Promoting % to admin', NEW.email;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'handle_first_user_profile: Error for %: SQLSTATE=%, SQLERRM=%', 
        NEW.email, SQLSTATE, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;