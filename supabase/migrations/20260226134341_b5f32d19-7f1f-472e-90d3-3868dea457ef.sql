
-- 1. Create tables in community schema
CREATE TABLE IF NOT EXISTS community.communication_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES community.products(id) ON DELETE CASCADE,
  object_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  function_text TEXT,
  channel_number INTEGER,
  channel_name TEXT,
  functional_block TEXT,
  dpt_id TEXT,
  dpt_name TEXT,
  dpt_size_bits INTEGER,
  dpt_unit TEXT,
  read_flag BOOLEAN DEFAULT FALSE,
  write_flag BOOLEAN DEFAULT FALSE,
  communicate_flag BOOLEAN DEFAULT FALSE,
  transmit_flag BOOLEAN DEFAULT FALSE,
  update_flag BOOLEAN DEFAULT FALSE,
  read_on_init_flag BOOLEAN DEFAULT FALSE,
  value_min TEXT,
  value_max TEXT,
  default_value TEXT,
  priority TEXT DEFAULT 'low',
  description TEXT,
  extraction_confidence FLOAT DEFAULT 0,
  source_document_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES community.products(id) ON DELETE CASCADE,
  param_name TEXT NOT NULL,
  param_group TEXT,
  param_subgroup TEXT,
  channel_number INTEGER,
  channel_name TEXT,
  param_type TEXT,
  default_value TEXT,
  value_min TEXT,
  value_max TEXT,
  value_unit TEXT,
  step_size TEXT,
  enum_values JSONB,
  description TEXT,
  ets_parameter_id TEXT,
  extraction_confidence FLOAT DEFAULT 0,
  source_document_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.functional_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES community.products(id) ON DELETE CASCADE,
  block_name TEXT NOT NULL,
  block_type TEXT,
  channel_count INTEGER,
  description TEXT,
  extraction_confidence FLOAT DEFAULT 0,
  source_document_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.technical_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES community.products(id) ON DELETE CASCADE,
  spec_category TEXT NOT NULL,
  spec_name TEXT NOT NULL,
  spec_value TEXT NOT NULL,
  spec_unit TEXT,
  spec_value_numeric FLOAT,
  extraction_confidence FLOAT DEFAULT 0,
  source_document_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_comm_objects_product ON community.communication_objects(product_id);
CREATE INDEX IF NOT EXISTS idx_comm_objects_dpt ON community.communication_objects(dpt_id);
CREATE INDEX IF NOT EXISTS idx_params_product ON community.parameters(product_id);
CREATE INDEX IF NOT EXISTS idx_func_blocks_product ON community.functional_blocks(product_id);
CREATE INDEX IF NOT EXISTS idx_tech_specs_product ON community.technical_specifications(product_id);

-- 3. Public views
CREATE OR REPLACE VIEW public.community_communication_objects AS SELECT * FROM community.communication_objects;
CREATE OR REPLACE VIEW public.community_parameters AS SELECT * FROM community.parameters;
CREATE OR REPLACE VIEW public.community_functional_blocks AS SELECT * FROM community.functional_blocks;
CREATE OR REPLACE VIEW public.community_technical_specifications AS SELECT * FROM community.technical_specifications;

-- 4. Permissions
GRANT SELECT ON public.community_communication_objects TO anon, authenticated;
GRANT SELECT ON public.community_parameters TO anon, authenticated;
GRANT SELECT ON public.community_functional_blocks TO anon, authenticated;
GRANT SELECT ON public.community_technical_specifications TO anon, authenticated;
GRANT ALL ON community.communication_objects TO service_role;
GRANT ALL ON community.parameters TO service_role;
GRANT ALL ON community.functional_blocks TO service_role;
GRANT ALL ON community.technical_specifications TO service_role;

-- 5. INSTEAD OF INSERT triggers

-- Communication Objects
CREATE OR REPLACE FUNCTION public.community_communication_objects_insert_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community.communication_objects (
    product_id, object_number, name, function_text,
    channel_number, channel_name, functional_block,
    dpt_id, dpt_name, dpt_size_bits, dpt_unit,
    read_flag, write_flag, communicate_flag, transmit_flag, update_flag, read_on_init_flag,
    value_min, value_max, default_value, priority, description,
    extraction_confidence, source_document_id
  ) VALUES (
    NEW.product_id, NEW.object_number, NEW.name, NEW.function_text,
    NEW.channel_number, NEW.channel_name, NEW.functional_block,
    NEW.dpt_id, NEW.dpt_name, NEW.dpt_size_bits, NEW.dpt_unit,
    NEW.read_flag, NEW.write_flag, NEW.communicate_flag, NEW.transmit_flag, NEW.update_flag, NEW.read_on_init_flag,
    NEW.value_min, NEW.value_max, NEW.default_value, NEW.priority, NEW.description,
    NEW.extraction_confidence, NEW.source_document_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER community_communication_objects_insert_trigger
INSTEAD OF INSERT ON public.community_communication_objects
FOR EACH ROW EXECUTE FUNCTION public.community_communication_objects_insert_fn();

-- Parameters
CREATE OR REPLACE FUNCTION public.community_parameters_insert_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community.parameters (
    product_id, param_name, param_group, param_subgroup,
    channel_number, channel_name,
    param_type, default_value, value_min, value_max, value_unit, step_size,
    enum_values, description, ets_parameter_id,
    extraction_confidence, source_document_id
  ) VALUES (
    NEW.product_id, NEW.param_name, NEW.param_group, NEW.param_subgroup,
    NEW.channel_number, NEW.channel_name,
    NEW.param_type, NEW.default_value, NEW.value_min, NEW.value_max, NEW.value_unit, NEW.step_size,
    NEW.enum_values, NEW.description, NEW.ets_parameter_id,
    NEW.extraction_confidence, NEW.source_document_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER community_parameters_insert_trigger
INSTEAD OF INSERT ON public.community_parameters
FOR EACH ROW EXECUTE FUNCTION public.community_parameters_insert_fn();

-- Functional Blocks
CREATE OR REPLACE FUNCTION public.community_functional_blocks_insert_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community.functional_blocks (
    product_id, block_name, block_type, channel_count, description,
    extraction_confidence, source_document_id
  ) VALUES (
    NEW.product_id, NEW.block_name, NEW.block_type, NEW.channel_count, NEW.description,
    NEW.extraction_confidence, NEW.source_document_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER community_functional_blocks_insert_trigger
INSTEAD OF INSERT ON public.community_functional_blocks
FOR EACH ROW EXECUTE FUNCTION public.community_functional_blocks_insert_fn();

-- Technical Specifications
CREATE OR REPLACE FUNCTION public.community_technical_specifications_insert_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community.technical_specifications (
    product_id, spec_category, spec_name, spec_value, spec_unit, spec_value_numeric,
    extraction_confidence, source_document_id
  ) VALUES (
    NEW.product_id, NEW.spec_category, NEW.spec_name, NEW.spec_value, NEW.spec_unit, NEW.spec_value_numeric,
    NEW.extraction_confidence, NEW.source_document_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER community_technical_specifications_insert_trigger
INSTEAD OF INSERT ON public.community_technical_specifications
FOR EACH ROW EXECUTE FUNCTION public.community_technical_specifications_insert_fn();
