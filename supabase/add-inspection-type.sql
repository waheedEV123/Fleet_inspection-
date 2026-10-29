-- Run once in Supabase SQL Editor: adds Handover / Return type and the staff mobile number.
alter table public.inspections add column if not exists type text not null default 'handover';
alter table public.inspections add column if not exists staff_mobile text;
