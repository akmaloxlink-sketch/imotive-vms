/*
  # Fix handle_new_user trigger - remove auth.users self-update

  1. Changes
    - Removes the UPDATE auth.users statement from handle_new_user()
      which was causing "database error saving new user" because
      modifying auth.users inside its own AFTER INSERT trigger
      creates a conflict
    - Profile creation logic is preserved
    - Email auto-confirmation is moved to a BEFORE INSERT trigger
      on auth.users which safely modifies NEW before the row is saved

  2. Important Notes
    - The BEFORE INSERT trigger sets email_confirmed_at on NEW directly,
      avoiding the self-update problem
    - The AFTER INSERT trigger only handles user_profiles creation
*/

-- Fix: Remove the auth.users UPDATE from handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, fleet_account, fleet_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'fleet_account', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'fleet_password', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-confirm email via BEFORE INSERT trigger (modifies NEW directly)
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := now();
  NEW.confirmed_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_email();
