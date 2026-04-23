/*
  # Fix prevent_unauthorized_profile_changes to allow service role edits

  1. Problem
    - The trigger function prevents changes to role and is_approved fields
    - When editing via Supabase UI (using service_role), auth.uid() returns NULL
    - NULL auth.uid() causes the admin check to fail, blocking legitimate edits

  2. Solution
    - Allow changes when auth.uid() is NULL (service_role context)
    - Keep protection for regular authenticated users who aren't admins
    - This enables admins to approve users via the Supabase dashboard

  3. Security
    - service_role access is already restricted to authorized admins
    - Regular users still cannot escalate their privileges
    - Only affects database UI edits, not frontend operations
*/

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_changes()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow changes if:
  -- 1. auth.uid() is NULL (service_role / database UI context)
  -- 2. User is an admin
  IF auth.uid() IS NOT NULL AND 
     NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    -- Non-admin user trying to modify protected fields
    NEW.role := OLD.role;
    NEW.is_approved := OLD.is_approved;
  END IF;
  
  RETURN NEW;
END;
$$;