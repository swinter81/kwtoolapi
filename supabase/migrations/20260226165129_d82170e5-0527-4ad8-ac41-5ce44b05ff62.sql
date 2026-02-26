-- Add extraction status to community.products
ALTER TABLE community.products 
  ADD COLUMN IF NOT EXISTS extraction_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extraction_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_error text;

-- Add check constraint via a validation trigger instead of CHECK (more flexible)
CREATE OR REPLACE FUNCTION community.validate_extraction_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.extraction_status NOT IN ('pending', 'identified', 'extracting', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid extraction_status: %', NEW.extraction_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_extraction_status ON community.products;
CREATE TRIGGER trg_validate_extraction_status
  BEFORE INSERT OR UPDATE ON community.products
  FOR EACH ROW EXECUTE FUNCTION community.validate_extraction_status();

-- Update existing products with data as 'completed'
UPDATE community.products p SET extraction_status = 'completed'
WHERE EXISTS (SELECT 1 FROM community.communication_objects co WHERE co.product_id = p.id);

-- Update products without data as 'identified'
UPDATE community.products p SET extraction_status = 'identified'
WHERE NOT EXISTS (SELECT 1 FROM community.communication_objects co WHERE co.product_id = p.id);

-- Recreate the view to include the new columns
DROP VIEW IF EXISTS public.community_products;
CREATE VIEW public.community_products AS SELECT * FROM community.products;

-- Recreate the INSTEAD OF INSERT trigger
CREATE OR REPLACE FUNCTION public.community_products_insert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO community.products VALUES (NEW.*);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_products_insert_trigger ON public.community_products;
CREATE TRIGGER community_products_insert_trigger
  INSTEAD OF INSERT ON public.community_products
  FOR EACH ROW EXECUTE FUNCTION public.community_products_insert_fn();

-- Recreate the INSTEAD OF UPDATE trigger
CREATE OR REPLACE FUNCTION public.community_products_update_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE community.products SET
    name = NEW.name,
    order_number = NEW.order_number,
    description = NEW.description,
    medium_types = NEW.medium_types,
    category = NEW.category,
    specifications = NEW.specifications,
    confidence_score = NEW.confidence_score,
    source_count = NEW.source_count,
    crawler_source_url = NEW.crawler_source_url,
    updated_at = NEW.updated_at,
    manufacturer_id = NEW.manufacturer_id,
    status = NEW.status,
    extraction_status = NEW.extraction_status,
    extraction_started_at = NEW.extraction_started_at,
    extraction_completed_at = NEW.extraction_completed_at,
    extraction_error = NEW.extraction_error
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_products_update_trigger ON public.community_products;
CREATE TRIGGER community_products_update_trigger
  INSTEAD OF UPDATE ON public.community_products
  FOR EACH ROW EXECUTE FUNCTION public.community_products_update_fn();