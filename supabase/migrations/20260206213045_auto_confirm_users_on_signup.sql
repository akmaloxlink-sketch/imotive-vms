/*
  # Auto-confirm users on signup

  1. Changes
    - Updates the `handle_new_user()` trigger function to automatically
      confirm the user's email during signup
    - This ensures users can log in immediately after registration
      without waiting for email confirmation

  2. Important Notes
    - The trigger runs as SECURITY DEFINER so it has permission to
      update auth.users
    - The existing profile creation logic is preserved
    - This is needed because Supabase email confirmation cannot be
      toggled via SQL
*/

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

  UPDATE auth.users
  SET email_confirmed_at = now(),
      confirmed_at = now()
  WHERE id = NEW.id
    AND email_confirmed_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
