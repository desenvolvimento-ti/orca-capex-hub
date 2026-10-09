
CREATE TABLE public.area_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  budget_amount numeric NOT NULL DEFAULT 0,
  warning_threshold numeric NOT NULL DEFAULT 0.8,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, cycle_id)
);

GRANT SELECT ON public.area_budgets TO authenticated;
GRANT ALL ON public.area_budgets TO service_role;

ALTER TABLE public.area_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver orçamentos"
  ON public.area_budgets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas FP&A gerencia orçamentos"
  ON public.area_budgets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'fpa'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'fpa'::app_role));

CREATE TRIGGER trg_area_budgets_touch
  BEFORE UPDATE ON public.area_budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.area_budget_usage(p_cycle_id uuid)
RETURNS TABLE(
  area_id uuid, area_name text,
  budget_amount numeric, warning_threshold numeric,
  planned_amount numeric, approved_amount numeric, released_amount numeric,
  projects_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.name,
    COALESCE(b.budget_amount, 0),
    COALESCE(b.warning_threshold, 0.8),
    COALESCE(SUM(p.estimated_total), 0),
    COALESCE(SUM(p.ceo_approved_amount), 0),
    COALESCE(SUM(p.released_amount), 0),
    COUNT(p.id)
  FROM public.areas a
  LEFT JOIN public.area_budgets b ON b.area_id = a.id AND b.cycle_id = p_cycle_id
  LEFT JOIN public.projects p ON p.area_id = a.id AND p.cycle_id = p_cycle_id
  GROUP BY a.id, a.name, b.budget_amount, b.warning_threshold
  ORDER BY a.name;
$$;

CREATE OR REPLACE FUNCTION public.project_audit_timeline(p_project_id uuid)
RETURNS TABLE(
  event_at timestamptz, kind text,
  actor_id uuid, actor_name text, actor_role text,
  from_status text, to_status text, comment text, ref_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM (
    SELECT h.created_at AS event_at, 'status'::text AS kind,
           h.actor_id, pr.full_name AS actor_name, h.actor_role::text AS actor_role,
           h.from_status::text AS from_status, h.to_status::text AS to_status,
           h.comment, h.id AS ref_id
      FROM public.project_status_history h
      LEFT JOIN public.profiles pr ON pr.id = h.actor_id
     WHERE h.project_id = p_project_id
    UNION ALL
    SELECT crh.created_at, 'change_request',
           crh.actor_id, pr.full_name, crh.actor_role::text,
           crh.from_status::text, crh.to_status::text, crh.comment, crh.request_id
      FROM public.project_change_request_history crh
      JOIN public.project_change_requests cr ON cr.id = crh.request_id
      LEFT JOIN public.profiles pr ON pr.id = crh.actor_id
     WHERE cr.project_id = p_project_id
    UNION ALL
    SELECT d.uploaded_at, 'document',
           d.uploaded_by, pr.full_name, NULL,
           NULL, NULL, COALESCE(d.file_name, 'documento'), d.id
      FROM public.project_documents d
      LEFT JOIN public.profiles pr ON pr.id = d.uploaded_by
     WHERE d.project_id = p_project_id
    UNION ALL
    SELECT c.created_at, 'comment',
           c.author_id, pr.full_name, NULL,
           NULL, NULL, c.body, c.id
      FROM public.project_comments c
      LEFT JOIN public.profiles pr ON pr.id = c.author_id
     WHERE c.project_id = p_project_id
  ) t
  ORDER BY event_at DESC;
$$;
