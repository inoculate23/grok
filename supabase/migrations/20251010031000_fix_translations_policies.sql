/*
  # Expand translations table policies for authenticated users

  1. Changes
    - Add policies allowing authenticated users to INSERT and SELECT on `translations`
    - Keeps existing anon policies intact for public access

  2. Rationale
    - Prevents 403 errors when an authenticated session reads/saves translations
*/

-- Allow authenticated users to insert translations
CREATE POLICY "Authenticated can insert translations"
  ON translations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read translations
CREATE POLICY "Authenticated can read translations"
  ON translations
  FOR SELECT
  TO authenticated
  USING (true);