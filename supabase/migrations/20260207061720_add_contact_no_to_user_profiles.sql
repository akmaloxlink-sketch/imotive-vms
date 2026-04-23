/*
  # Add contact number field to user profiles

  1. Changes
    - Add `contact_no` (text, nullable) to `user_profiles` table
    - Contact number is optional during registration

  2. Notes
    - Contact number is stored as text to preserve formatting and support international numbers
    - Field is nullable to allow optional input during registration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'contact_no'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN contact_no text;
  END IF;
END $$;