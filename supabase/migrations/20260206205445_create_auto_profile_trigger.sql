/*
  # Auto-create user profile on signup via trigger

  1. Changes
    - Creates a trigger function `handle_new_user()` that automatically
      creates a `user_profiles` row when a new user signs up
    - Fleet credentials are passed via `raw_user_meta_data` during signUp
    - This bypasses RLS since the function runs as SECURITY DEFINER

  2. Important Notes
    - The existing `handle_first_user_profile` trigger still runs on
      the `user_profiles` INSERT to promote the first user to admin
    - This removes the need for the frontend to insert the profile
      manually (which fails when there is no active session)
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
