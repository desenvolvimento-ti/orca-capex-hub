ALTER TABLE public.projects ADD COLUMN tir_pct numeric;
COMMENT ON COLUMN public.projects.tir_pct IS 'Taxa Interna de Retorno estimada do projeto (em %). Opcional na Etapa 1.';