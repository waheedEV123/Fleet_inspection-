-- Run once in Supabase SQL Editor to add the staff email to inspections.
alter table public.inspections add column if not exists staff_email text;
