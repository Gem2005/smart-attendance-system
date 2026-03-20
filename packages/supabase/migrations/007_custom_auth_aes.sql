-- 007_custom_auth_aes.sql
-- Migration to detach from auth.users and use custom encrypted passwords

-- 1. Drop foreign key constraints linking to auth.users
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_id_fkey;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_id_fkey;

-- 2. Ensure primary keys auto-generate UUIDs since we won't rely on auth.users anymore
ALTER TABLE teachers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE students ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Add encrypted_password columns
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
