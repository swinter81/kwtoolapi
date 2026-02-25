-- Writable views in public schema for community tables used by crawler-ingest

CREATE OR REPLACE VIEW public.community_manufacturers AS
  SELECT * FROM community.manufacturers;

CREATE OR REPLACE VIEW public.community_products AS
  SELECT * FROM community.products;

CREATE OR REPLACE VIEW public.community_crawled_documents AS
  SELECT * FROM community.crawled_documents;

CREATE OR REPLACE VIEW public.community_crawled_document_chunks AS
  SELECT * FROM community.crawled_document_chunks;

CREATE OR REPLACE VIEW public.community_crawl_runs AS
  SELECT * FROM community.crawl_runs;

-- Make views updatable/insertable by creating INSTEAD OF triggers

CREATE OR REPLACE FUNCTION public.community_products_insert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO community.products VALUES (NEW.*);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_products_update_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
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
    status = NEW.status
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_products_insert
  INSTEAD OF INSERT ON public.community_products
  FOR EACH ROW EXECUTE FUNCTION public.community_products_insert_fn();

CREATE TRIGGER community_products_update
  INSTEAD OF UPDATE ON public.community_products
  FOR EACH ROW EXECUTE FUNCTION public.community_products_update_fn();

-- crawled_documents insert trigger
CREATE OR REPLACE FUNCTION public.community_crawled_documents_insert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO community.crawled_documents VALUES (NEW.*);
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_crawled_documents_insert
  INSTEAD OF INSERT ON public.community_crawled_documents
  FOR EACH ROW EXECUTE FUNCTION public.community_crawled_documents_insert_fn();

-- crawled_documents update trigger
CREATE OR REPLACE FUNCTION public.community_crawled_documents_update_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  UPDATE community.crawled_documents SET
    chunk_count = NEW.chunk_count
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_crawled_documents_update
  INSTEAD OF UPDATE ON public.community_crawled_documents
  FOR EACH ROW EXECUTE FUNCTION public.community_crawled_documents_update_fn();

-- crawled_document_chunks insert trigger
CREATE OR REPLACE FUNCTION public.community_crawled_document_chunks_insert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO community.crawled_document_chunks VALUES (NEW.*);
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_crawled_document_chunks_insert
  INSTEAD OF INSERT ON public.community_crawled_document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.community_crawled_document_chunks_insert_fn();

-- crawl_runs insert trigger
CREATE OR REPLACE FUNCTION public.community_crawl_runs_insert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO community.crawl_runs VALUES (NEW.*);
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_crawl_runs_insert
  INSTEAD OF INSERT ON public.community_crawl_runs
  FOR EACH ROW EXECUTE FUNCTION public.community_crawl_runs_insert_fn();