/*
  # Update handle_new_user function to include contact number

  1. Changes
    - Update handle_new_user() function to extract and save contact_no from user metadata
    - Contact number is optional and will be saved if provided during registration

  2. Notes
    - Uses COALESCE to handle cases where contact_no is not provided
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, fleet_account, fleet_password, contact_no)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'fleet_account', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'fleet_password', ''),
    NEW.raw_user_meta_data ->> 'contact_no'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;