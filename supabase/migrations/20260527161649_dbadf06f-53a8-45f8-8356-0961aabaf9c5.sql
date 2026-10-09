-- 1. Adicionar valor 'nao_aprovado' ao enum project_status
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'nao_aprovado';

-- 2. Novas colunas em projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS flag_next_cycle BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previously_deferred_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_deferral_reason TEXT;

-- 3. Função archive_cycle: arquiva ciclo e devolve projetos não aprovados ao hub
CREATE OR REPLACE FUNCTION public.archive_cycle(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF NOT has_role(auth.uid(), 'fpa'::app_role) THEN
    RAISE EXCEPTION 'Apenas FP&A pode arquivar ciclos';
  END IF;

  -- Para cada projeto "não aprovado" / "reprovado" / "postergado" / "cancelado" do ciclo:
  --   incrementa contador, copia última justificativa, devolve ao hub.
  FOR v_reason IN
    SELECT id::text FROM public.projects
    WHERE cycle_id = p_cycle_id
      AND status::text IN ('nao_aprovado','reprovado','postergado','cancelado')
  LOOP
    UPDATE public.projects p
       SET previously_deferred_count = COALESCE(p.previously_deferred_count, 0) + 1,
           last_deferral_reason = COALESCE(
             (SELECT h.comment
                FROM public.project_status_history h
               WHERE h.project_id = p.id
                 AND h.to_status::text IN ('nao_aprovado','reprovado','postergado','cancelado')
               ORDER BY h.created_at DESC
               LIMIT 1),
             p.last_deferral_reason
           ),
           cycle_id = NULL,
           code = NULL,
           status = 'no_hub'::project_status,
           flag_next_cycle = false,
           submitted_at = NULL,
           decided_at = NULL,
           updated_at = now()
     WHERE p.id = v_reason::uuid;
  END LOOP;

  UPDATE public.cycles
     SET archived_at = now(),
         is_active = false
   WHERE id = p_cycle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_cycle(uuid) TO authenticated;