/*
  # Create vehicle devices table

  1. New Tables
    - `vehicle_devices`
      - `id` (uuid, primary key) - Unique identifier
      - `vehicle_id` (text, unique) - Vehicle plate number (nm/vid)
      - `device_id` (text) - Device ID (did)
      - `device_type` (integer) - Device type (1 = video device, 0 = gps device)
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_at` (timestamptz) - Creation timestamp
  
  2. Security
    - Enable RLS on `vehicle_devices` table
    - Add policy for authenticated users to read all device data
    - Add policy for authenticated users to insert device data
    - Add policy for authenticated users to update device data
  
  3. Indexes
    - Add index on vehicle_id for faster lookups
*/

CREATE TABLE IF NOT EXISTS vehicle_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id text UNIQUE NOT NULL,
  device_id text NOT NULL,
  device_type integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all device data"
  ON vehicle_devices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert device data"
  ON vehicle_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update device data"
  ON vehicle_devices
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete device data"
  ON vehicle_devices
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_vehicle_devices_vehicle_id ON vehicle_devices(vehicle_id);