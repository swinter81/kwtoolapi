-- View: community_crawl_sources
CREATE OR REPLACE VIEW public.community_crawl_sources AS
SELECT
  id, name, manufacturer_knx_id, base_url, sitemap_url, is_active,
  product_url_pattern, document_url_pattern, exclude_url_pattern,
  rate_limit_seconds, max_urls_per_run, total_urls_known, total_urls_processed,
  last_discovery_at, last_processing_at, created_at, updated_at
FROM community.crawl_sources;

-- View: community_crawl_urls
CREATE OR REPLACE VIEW public.community_crawl_urls AS
SELECT
  id, source_id, url, url_type, status, content_hash, last_http_status,
  last_fetched_at, etag, last_modified, products_extracted, documents_extracted,
  extraction_confidence, error_message, retry_count, discovered_via, priority,
  created_at, updated_at
FROM community.crawl_urls;

-- Grant SELECT on both views
GRANT SELECT ON public.community_crawl_sources TO anon, authenticated;
GRANT SELECT ON public.community_crawl_urls TO anon, authenticated;

-- INSTEAD OF UPDATE trigger for community_crawl_urls
CREATE OR REPLACE FUNCTION public.community_crawl_urls_update_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE community.crawl_urls SET
    status = NEW.status,
    content_hash = NEW.content_hash,
    last_http_status = NEW.last_http_status,
    last_fetched_at = NEW.last_fetched_at,
    etag = NEW.etag,
    last_modified = NEW.last_modified,
    products_extracted = NEW.products_extracted,
    documents_extracted = NEW.documents_extracted,
    extraction_confidence = NEW.extraction_confidence,
    error_message = NEW.error_message,
    retry_count = NEW.retry_count,
    priority = NEW.priority,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_crawl_urls_update_trigger
  INSTEAD OF UPDATE ON public.community_crawl_urls
  FOR EACH ROW EXECUTE FUNCTION public.community_crawl_urls_update_fn();

-- INSTEAD OF INSERT trigger for community_crawl_urls
CREATE OR REPLACE FUNCTION public.community_crawl_urls_insert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO community.crawl_urls VALUES (NEW.*);
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_crawl_urls_insert_trigger
  INSTEAD OF INSERT ON public.community_crawl_urls
  FOR EACH ROW EXECUTE FUNCTION public.community_crawl_urls_insert_fn();

-- INSTEAD OF INSERT trigger for community_crawl_sources
CREATE OR REPLACE FUNCTION public.community_crawl_sources_insert_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO community.crawl_sources VALUES (NEW.*);
  RETURN NEW;
END;
$$;

CREATE TRIGGER community_crawl_sources_insert_trigger
  INSTEAD OF INSERT ON public.community_crawl_sources
  FOR EACH ROW EXECUTE FUNCTION public.community_crawl_sources_insert_fn();