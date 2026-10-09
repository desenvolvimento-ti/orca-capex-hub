CREATE OR REPLACE FUNCTION public.gen_project_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT;
  v_year INT;
  v_next INT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    IF NEW.execution_start_date IS NULL THEN
      RETURN NEW;
    END IF;

    v_prefix := CASE NEW.category::text
      WHEN 'implementacao_novos_negocios' THEN 'NOV'
      WHEN 'aprimoramento_negocios_existentes' THEN 'APR'
      WHEN 'manutencao_extraordinaria' THEN 'MEX'
      WHEN 'intangivel_ti' THEN 'INT'
      WHEN 'ativo_biologico' THEN 'BIO'
      ELSE 'CAP'
    END;
    v_year := EXTRACT(YEAR FROM NEW.execution_start_date)::INT;

    PERFORM pg_advisory_xact_lock(hashtext(v_prefix || '-' || v_year::text));

    SELECT COALESCE(MAX((substring(code FROM '([0-9]+)$'))::INT), 0) + 1
      INTO v_next
      FROM public.projects
     WHERE code LIKE v_prefix || '-' || v_year::text || '-%'
       AND code ~ ('^' || v_prefix || '-' || v_year::text || '-[0-9]+$');

    NEW.code := v_prefix || '-' || v_year::text || '-' || LPAD(v_next::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE TRIGGER trg_gen_project_code
BEFORE INSERT OR UPDATE OF category, execution_start_date ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.gen_project_code();

COMMENT ON FUNCTION public.gen_project_code() IS 'Gera códigos novos no formato sigla da categoria-ano de início da execução-sequência, sem alterar códigos existentes.';