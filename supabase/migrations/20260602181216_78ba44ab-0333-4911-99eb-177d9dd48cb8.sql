-- =====================================================================
-- Solicitações de alteração de projeto (prazo / valor) pelo gestor
-- Fluxo: pendente_fpa -> aguardando_diretor -> aguardando_ceo -> aprovado
--        (com possibilidade de devolvido_revisao / reprovado em cada etapa)
-- Quando aprovado: aplica os campos solicitados ao projeto e remove
-- desembolsos (cronograma) fora da nova janela de execução/planejamento.
-- =====================================================================

CREATE TYPE public.change_request_status AS ENUM (
  'pendente_fpa',
  'aguardando_diretor',
  'aguardando_ceo',
  'aprovado',
  'devolvido_revisao',
  'reprovado'
);

CREATE TABLE public.project_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  status public.change_request_status NOT NULL DEFAULT 'pendente_fpa',
  justification text NOT NULL,
  requested_total numeric,
  requested_execution_start date,
  requested_execution_end date,
  requested_planning_end date,
  last_decision_comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_change_requests_project ON public.project_change_requests(project_id);
CREATE INDEX idx_project_change_requests_status ON public.project_change_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_change_requests TO authenticated;
GRANT ALL ON public.project_change_requests TO service_role;

ALTER TABLE public.project_change_requests ENABLE ROW LEVEL SECURITY;

-- Owner do projeto, FP&A e Diretoria podem ler
CREATE POLICY pcr_select ON public.project_change_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = project_change_requests.project_id
       AND (
         p.owner_id = auth.uid()
         OR public.has_role(auth.uid(), 'fpa'::app_role)
         OR public.has_role(auth.uid(), 'ceo'::app_role)
         OR public.has_role(auth.uid(), 'cfo'::app_role)
         OR public.has_role(auth.uid(), 'cco'::app_role)
         OR public.has_role(auth.uid(), 'cmo'::app_role)
       )
  )
);

-- Owner cria o pedido; FP&A também pode (em nome do gestor / simulação)
CREATE POLICY pcr_insert ON public.project_change_requests
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = project_change_requests.project_id
       AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'fpa'::app_role))
  )
);

-- Atualização é mediada por RPC (security definer)
CREATE POLICY pcr_update_fpa ON public.project_change_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'fpa'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'fpa'::app_role));

CREATE TRIGGER trg_pcr_touch
BEFORE UPDATE ON public.project_change_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Histórico de decisões da solicitação
CREATE TABLE public.project_change_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  from_status public.change_request_status,
  to_status public.change_request_status NOT NULL,
  actor_id uuid,
  actor_role public.app_role,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pcr_history_request ON public.project_change_request_history(request_id);

GRANT SELECT, INSERT ON public.project_change_request_history TO authenticated;
GRANT ALL ON public.project_change_request_history TO service_role;

ALTER TABLE public.project_change_request_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcrh_select ON public.project_change_request_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_change_requests r
      JOIN public.projects p ON p.id = r.project_id
     WHERE r.id = project_change_request_history.request_id
       AND (
         p.owner_id = auth.uid()
         OR public.has_role(auth.uid(), 'fpa'::app_role)
         OR public.has_role(auth.uid(), 'ceo'::app_role)
         OR public.has_role(auth.uid(), 'cfo'::app_role)
         OR public.has_role(auth.uid(), 'cco'::app_role)
         OR public.has_role(auth.uid(), 'cmo'::app_role)
       )
  )
);

CREATE POLICY pcrh_insert ON public.project_change_request_history
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- =====================================================================
-- RPC: criar solicitação
-- =====================================================================
CREATE OR REPLACE FUNCTION public.solicitar_alteracao(
  p_project_id uuid,
  p_justificativa text,
  p_requested_total numeric DEFAULT NULL,
  p_requested_execution_start date DEFAULT NULL,
  p_requested_execution_end date DEFAULT NULL,
  p_requested_planning_end date DEFAULT NULL
) RETURNS public.project_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_proj public.projects;
  v_req public.project_change_requests;
  v_open int;
BEGIN
  IF p_justificativa IS NULL OR length(trim(p_justificativa)) = 0 THEN
    RAISE EXCEPTION 'Informe uma justificativa para a alteração.';
  END IF;
  IF p_requested_total IS NULL
     AND p_requested_execution_start IS NULL
     AND p_requested_execution_end IS NULL
     AND p_requested_planning_end IS NULL THEN
    RAISE EXCEPTION 'Informe pelo menos um campo a alterar (valor ou datas).';
  END IF;

  SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF v_proj.owner_id <> auth.uid() AND NOT has_role(auth.uid(), 'fpa'::app_role) THEN
    RAISE EXCEPTION 'Apenas o gestor responsável (ou FP&A) pode solicitar alteração.';
  END IF;

  IF v_proj.status NOT IN ('liberado'::project_status, 'liberado_parcial'::project_status) THEN
    RAISE EXCEPTION 'Só é possível solicitar alteração em projetos já liberados.';
  END IF;

  SELECT count(*) INTO v_open FROM public.project_change_requests
   WHERE project_id = p_project_id
     AND status IN ('pendente_fpa','aguardando_diretor','aguardando_ceo','devolvido_revisao');
  IF v_open > 0 THEN
    RAISE EXCEPTION 'Já existe uma solicitação de alteração em andamento para este projeto.';
  END IF;

  INSERT INTO public.project_change_requests
    (project_id, requested_by, justification, requested_total,
     requested_execution_start, requested_execution_end, requested_planning_end)
  VALUES
    (p_project_id, auth.uid(), trim(p_justificativa), p_requested_total,
     p_requested_execution_start, p_requested_execution_end, p_requested_planning_end)
  RETURNING * INTO v_req;

  INSERT INTO public.project_change_request_history
    (request_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES
    (v_req.id, NULL, 'pendente_fpa', auth.uid(),
     CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
     'Solicitação criada');

  RETURN v_req;
END $$;

-- =====================================================================
-- RPC: decisão sobre a solicitação (FP&A / Diretor / CEO)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.decisao_alteracao(
  p_request_id uuid,
  p_acao text,
  p_justificativa text
) RETURNS public.project_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.project_change_requests;
  v_proj public.projects;
  v_director uuid;
  v_role app_role;
  v_from change_request_status;
  v_to change_request_status;
  v_is_fpa boolean;
  v_new_exec_start date;
  v_new_exec_end date;
  v_new_plan_end date;
  v_new_total numeric;
BEGIN
  IF p_acao NOT IN ('aprovar','devolver','reprovar') THEN
    RAISE EXCEPTION 'Ação inválida: %', p_acao;
  END IF;
  IF p_acao IN ('devolver','reprovar') AND (p_justificativa IS NULL OR length(trim(p_justificativa)) = 0) THEN
    RAISE EXCEPTION 'Justificativa obrigatória para devolver ou reprovar.';
  END IF;

  SELECT * INTO v_req FROM public.project_change_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  v_from := v_req.status;

  SELECT * INTO v_proj FROM public.projects WHERE id = v_req.project_id;

  v_is_fpa := has_role(auth.uid(), 'fpa'::app_role);

  SELECT role INTO v_role FROM public.user_roles
   WHERE user_id = auth.uid()
     AND role IN ('ceo','cfo','cco','cmo','fpa')
   ORDER BY CASE role WHEN 'ceo' THEN 1 WHEN 'cfo' THEN 2 WHEN 'cco' THEN 3 WHEN 'cmo' THEN 4 ELSE 5 END
   LIMIT 1;

  IF v_req.status = 'pendente_fpa' THEN
    IF NOT v_is_fpa THEN RAISE EXCEPTION 'Apenas FP&A pode decidir nesta etapa.'; END IF;
    IF p_acao = 'aprovar' THEN v_to := 'aguardando_diretor';
    ELSIF p_acao = 'devolver' THEN v_to := 'devolvido_revisao';
    ELSE v_to := 'reprovado';
    END IF;

  ELSIF v_req.status = 'aguardando_diretor' THEN
    IF NOT v_is_fpa THEN
      SELECT director_id INTO v_director FROM public.areas WHERE id = v_proj.area_id;
      IF v_director IS NULL OR v_director <> auth.uid() THEN
        RAISE EXCEPTION 'Apenas o Diretor da área (ou FP&A em simulação) pode decidir.';
      END IF;
    END IF;
    IF p_acao = 'aprovar' THEN v_to := 'aguardando_ceo';
    ELSIF p_acao = 'devolver' THEN v_to := 'devolvido_revisao';
    ELSE v_to := 'reprovado';
    END IF;

  ELSIF v_req.status = 'aguardando_ceo' THEN
    IF NOT (has_role(auth.uid(), 'ceo'::app_role) OR v_is_fpa) THEN
      RAISE EXCEPTION 'Apenas o CEO (ou FP&A em simulação) pode decidir nesta etapa.';
    END IF;
    IF p_acao = 'aprovar' THEN v_to := 'aprovado';
    ELSIF p_acao = 'devolver' THEN v_to := 'devolvido_revisao';
    ELSE v_to := 'reprovado';
    END IF;

  ELSIF v_req.status = 'devolvido_revisao' THEN
    -- Devolvido: gestor pode reabrir (não tratado aqui) — bloqueia decisões adicionais.
    RAISE EXCEPTION 'Solicitação devolvida ao gestor — aguarde nova submissão.';
  ELSE
    RAISE EXCEPTION 'Solicitação não está em etapa de decisão (status atual: %)', v_req.status;
  END IF;

  UPDATE public.project_change_requests
     SET status = v_to,
         last_decision_comment = NULLIF(trim(p_justificativa), ''),
         decided_at = CASE WHEN v_to IN ('aprovado','reprovado') THEN now() ELSE decided_at END,
         updated_at = now()
   WHERE id = p_request_id
   RETURNING * INTO v_req;

  INSERT INTO public.project_change_request_history
    (request_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES
    (p_request_id, v_from, v_to, auth.uid(), v_role, NULLIF(trim(p_justificativa), ''));

  -- Se aprovado, aplica ao projeto e limpa desembolsos fora da nova janela
  IF v_to = 'aprovado' THEN
    v_new_exec_start := COALESCE(v_req.requested_execution_start, v_proj.execution_start_date, v_proj.est_start_date);
    v_new_exec_end   := COALESCE(v_req.requested_execution_end,   v_proj.execution_end_date);
    v_new_plan_end   := COALESCE(v_req.requested_planning_end,    v_proj.planning_end_date);
    v_new_total      := COALESCE(v_req.requested_total,           v_proj.ceo_approved_amount, v_proj.confirmed_total, v_proj.estimated_total);

    UPDATE public.projects
       SET estimated_total = v_new_total,
           confirmed_total = v_new_total,
           ceo_approved_amount = v_new_total,
           released_amount = v_new_total,
           est_start_date = COALESCE(v_req.requested_execution_start, est_start_date),
           execution_start_date = v_new_exec_start,
           execution_end_date = v_new_exec_end,
           planning_end_date = v_new_plan_end,
           est_end_date = COALESCE(v_new_exec_end, est_end_date),
           updated_at = now()
     WHERE id = v_proj.id;

    -- Limpa desembolsos fora da nova janela (mês cheio)
    DELETE FROM public.disbursements
     WHERE project_id = v_proj.id
       AND (
         (v_new_exec_start IS NOT NULL AND period < date_trunc('month', v_new_exec_start)::date)
         OR
         (v_new_exec_end IS NOT NULL AND period > date_trunc('month', v_new_exec_end)::date)
       );
  END IF;

  RETURN v_req;
END $$;

GRANT EXECUTE ON FUNCTION public.solicitar_alteracao(uuid, text, numeric, date, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decisao_alteracao(uuid, text, text) TO authenticated;
