-- Change the default value of master_enabled to true
ALTER TABLE public.profiles
ALTER COLUMN master_enabled SET DEFAULT true;

-- Update existing profiles that have master_enabled set to false (or null) to true
-- Assuming the user wants it ON by default and it makes no sense to be OFF for existing users
UPDATE public.profiles
SET master_enabled = true
WHERE master_enabled = false OR master_enabled IS NULL;
