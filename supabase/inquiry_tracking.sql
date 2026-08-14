-- Sendora Gift inquiry tracking schema
-- Run this once in Supabase SQL Editor, then keep the service role key only in Vercel.

create extension if not exists pgcrypto;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  lead_ref text not null unique check (lead_ref ~ '^SG-[0-9]{8}-[A-Z0-9]{6,12}$'),
  visitor_id text,
  conversion_type text not null default 'form' check (conversion_type in ('form', 'whatsapp')),
  status text not null default 'new' check (status in ('new', 'whatsapp_clicked', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'spam')),
  name text,
  company text,
  email text,
  whatsapp_phone text,
  product_type text,
  quantity text,
  target_budget text,
  delivery_destination text,
  target_delivery_date text,
  branding_need text,
  packaging_need text,
  message text,
  source_context text,
  lead_source text default 'website',
  source_type text default 'direct',
  first_landing_page text,
  current_page text,
  referrer text,
  first_referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  msclkid text,
  ttclid text,
  browser_language text,
  user_timezone text,
  page_history text,
  visitor_country text,
  visitor_city text,
  user_agent text,
  email_provider_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);
create index if not exists inquiries_status_idx on public.inquiries (status);
create index if not exists inquiries_source_type_idx on public.inquiries (source_type);
create index if not exists inquiries_conversion_type_idx on public.inquiries (conversion_type);
create index if not exists inquiries_visitor_id_idx on public.inquiries (visitor_id);

alter table public.inquiries enable row level security;
revoke all on table public.inquiries from anon, authenticated;

comment on table public.inquiries is 'First-party inquiry attribution records. Accessed only by Vercel server functions with the Supabase service role.';
