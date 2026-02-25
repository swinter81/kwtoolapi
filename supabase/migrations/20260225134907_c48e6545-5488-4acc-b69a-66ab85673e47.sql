-- Create community registry tables (public read-only data)

-- Manufacturers table
CREATE TABLE public.manufacturers (
  id TEXT PRIMARY KEY,
  knx_manufacturer_id TEXT UNIQUE NOT NULL,
  hex_code TEXT NOT NULL,
  name TEXT,
  short_name TEXT,
  country TEXT,
  website_url TEXT,
  product_count INTEGER DEFAULT 0,
  application_program_count INTEGER DEFAULT 0,
  confidence_score FLOAT DEFAULT 0,
  source_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id TEXT PRIMARY KEY,
  knx_product_id TEXT UNIQUE NOT NULL,
  knx_hardware_id TEXT,
  manufacturer_id TEXT REFERENCES public.manufacturers(id),
  name TEXT,
  order_number TEXT,
  description TEXT,
  medium_types TEXT[],
  bus_current_ma FLOAT,
  is_coupler BOOLEAN DEFAULT FALSE,
  is_ip_device BOOLEAN DEFAULT FALSE,
  is_power_supply BOOLEAN DEFAULT FALSE,
  confidence_score FLOAT DEFAULT 0,
  source_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Application programs table
CREATE TABLE public.application_programs (
  id TEXT PRIMARY KEY,
  knx_application_id TEXT UNIQUE NOT NULL,
  knx_program_id TEXT,
  manufacturer_id TEXT REFERENCES public.manufacturers(id),
  product_id TEXT REFERENCES public.products(id),
  name TEXT,
  version TEXT,
  application_number TEXT,
  communication_object_count INTEGER,
  max_group_address_links INTEGER,
  confidence_score FLOAT DEFAULT 0,
  source_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hardware program mappings table
CREATE TABLE public.hardware_program_mappings (
  id TEXT PRIMARY KEY,
  knx_hw2prog_id TEXT UNIQUE NOT NULL,
  product_id TEXT REFERENCES public.products(id),
  application_program_id TEXT REFERENCES public.application_programs(id),
  status TEXT DEFAULT 'approved'
);

-- DPTs table
CREATE TABLE public.dpts (
  id TEXT PRIMARY KEY,
  dpt_id TEXT UNIQUE NOT NULL,
  number TEXT NOT NULL,
  main_number INTEGER NOT NULL,
  sub_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  size_bits INTEGER,
  unit TEXT,
  range_low TEXT,
  range_high TEXT,
  encoding_description TEXT
);

-- API keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  tier TEXT DEFAULT 'free',
  rate_limit_per_min INTEGER NOT NULL DEFAULT 300,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Full-text search indexes
CREATE INDEX idx_mfr_search ON public.manufacturers
  USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(short_name, '')));
CREATE INDEX idx_prod_search ON public.products
  USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(order_number, '') || ' ' || coalesce(description, '')));
CREATE INDEX idx_app_search ON public.application_programs
  USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(version, '')));
CREATE INDEX idx_dpt_search ON public.dpts
  USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));

-- Additional indexes
CREATE INDEX idx_products_manufacturer ON public.products(manufacturer_id);
CREATE INDEX idx_app_manufacturer ON public.application_programs(manufacturer_id);
CREATE INDEX idx_app_product ON public.application_programs(product_id);
CREATE INDEX idx_hw_prog_product ON public.hardware_program_mappings(product_id);
CREATE INDEX idx_hw_prog_app ON public.hardware_program_mappings(application_program_id);
CREATE INDEX idx_dpts_main_number ON public.dpts(main_number);

-- Enable RLS on all tables
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_program_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Public read-only policies for community data tables
CREATE POLICY "Public read access" ON public.manufacturers FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.application_programs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.hardware_program_mappings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.dpts FOR SELECT USING (true);

-- API keys: no public read (only via edge functions with service role)

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_manufacturers_updated_at BEFORE UPDATE ON public.manufacturers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_application_programs_updated_at BEFORE UPDATE ON public.application_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();