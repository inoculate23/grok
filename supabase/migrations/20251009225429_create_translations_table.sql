/*
  # Create translations table

  1. New Tables
    - `translations`
      - `id` (uuid, primary key) - Unique identifier for each translation
      - `source_text` (text) - Original text to be translated
      - `translated_text` (text) - Resulting translated text
      - `source_language` (text) - Language code of source text (e.g., 'en', 'es')
      - `target_language` (text) - Language code of target text
      - `translation_type` (text) - Type of input: 'text', 'audio', 'video', 'camera'
      - `created_at` (timestamptz) - Timestamp of translation creation
      
  2. Security
    - Enable RLS on `translations` table
    - Add policy for anyone to insert translations (public app)
    - Add policy for anyone to read translations (public app)
*/

CREATE TABLE IF NOT EXISTS translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text text NOT NULL,
  translated_text text NOT NULL,
  source_language text NOT NULL DEFAULT 'auto',
  target_language text NOT NULL,
  translation_type text NOT NULL DEFAULT 'text',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert translations"
  ON translations
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read translations"
  ON translations
  FOR SELECT
  TO anon
  USING (true);