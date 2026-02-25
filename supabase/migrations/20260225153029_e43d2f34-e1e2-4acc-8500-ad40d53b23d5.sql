-- Fix security definer views by recreating with security_invoker=on
DROP VIEW IF EXISTS public.community_manufacturers;
DROP VIEW IF EXISTS public.community_products;
DROP VIEW IF EXISTS public.community_crawled_documents;
DROP VIEW IF EXISTS public.community_crawled_document_chunks;
DROP VIEW IF EXISTS public.community_crawl_runs;

CREATE VIEW public.community_manufacturers
  WITH (security_invoker=on) AS SELECT * FROM community.manufacturers;

CREATE VIEW public.community_products
  WITH (security_invoker=on) AS SELECT * FROM community.products;

CREATE VIEW public.community_crawled_documents
  WITH (security_invoker=on) AS SELECT * FROM community.crawled_documents;

CREATE VIEW public.community_crawled_document_chunks
  WITH (security_invoker=on) AS SELECT * FROM community.crawled_document_chunks;

CREATE VIEW public.community_crawl_runs
  WITH (security_invoker=on) AS SELECT * FROM community.crawl_runs;

-- Recreate INSTEAD OF triggers (they were dropped with the views)
CREATE TRIGGER community_products_insert
  INSTEAD OF INSERT ON public.community_products
  FOR EACH ROW EXECUTE FUNCTION public.community_products_insert_fn();

CREATE TRIGGER community_products_update
  INSTEAD OF UPDATE ON public.community_products
  FOR EACH ROW EXECUTE FUNCTION public.community_products_update_fn();

CREATE TRIGGER community_crawled_documents_insert
  INSTEAD OF INSERT ON public.community_crawled_documents
  FOR EACH ROW EXECUTE FUNCTION public.community_crawled_documents_insert_fn();

CREATE TRIGGER community_crawled_documents_update
  INSTEAD OF UPDATE ON public.community_crawled_documents
  FOR EACH ROW EXECUTE FUNCTION public.community_crawled_documents_update_fn();

CREATE TRIGGER community_crawled_document_chunks_insert
  INSTEAD OF INSERT ON public.community_crawled_document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.community_crawled_document_chunks_insert_fn();

CREATE TRIGGER community_crawl_runs_insert
  INSTEAD OF INSERT ON public.community_crawl_runs
  FOR EACH ROW EXECUTE FUNCTION public.community_crawl_runs_insert_fn();