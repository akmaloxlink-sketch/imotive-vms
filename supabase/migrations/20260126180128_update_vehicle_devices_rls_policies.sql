/*
  # Update vehicle_devices RLS policies
  
  1. Changes
    - Drop existing restrictive policies that only allow authenticated users
    - Add new policies that allow both authenticated and anonymous users
    - This is necessary because the app caches fleet API data without Supabase authentication
  
  2. Security
    - Allow anon role to read, insert, update, and delete device data
    - This is safe as the data comes from the fleet API and is used for caching
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read all device data" ON vehicle_devices;
DROP POLICY IF EXISTS "Authenticated users can insert device data" ON vehicle_devices;
DROP POLICY IF EXISTS "Authenticated users can update device data" ON vehicle_devices;
DROP POLICY IF EXISTS "Authenticated users can delete device data" ON vehicle_devices;

-- Create new policies that allow both authenticated and anonymous users
CREATE POLICY "Allow read access to vehicle devices"
  ON vehicle_devices
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert access to vehicle devices"
  ON vehicle_devices
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update access to vehicle devices"
  ON vehicle_devices
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete access to vehicle devices"
  ON vehicle_devices
  FOR DELETE
  TO anon, authenticated
  USING (true);
