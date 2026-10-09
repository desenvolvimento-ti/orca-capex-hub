
-- ===== Onda 1: required document types, document linkage, realized disbursements =====

-- 1) Catalog of required document types
CREATE TABLE public.required_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  required_for_stage int NOT NULL DEFAULT 1 CHECK (required_for_stage IN (1, 2)),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.required_document_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.required_document_types TO authenticated;
GRANT ALL ON public.required_document_types TO service_role;

ALTER TABLE public.required_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read required doc types"
  ON public.required_document_types FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "FP&A manage required doc types insert"
  ON public.required_document_types FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'fpa'::app_role));

CREATE POLICY "FP&A manage required doc types update"
  ON public.required_document_types FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'fpa'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'fpa'::app_role));

CREATE POLICY "FP&A manage required doc types delete"
  ON public.required_document_types FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'fpa'::app_role));

CREATE TRIGGER trg_required_doc_types_updated
  BEFORE UPDATE ON public.required_document_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed initial types
INSERT INTO public.required_document_types (key, label, description, required_for_stage, sort_order) VALUES
  ('escopo_tecnico', 'Escopo técnico', 'Descrição técnica e premissas do projeto.', 1, 10),
  ('orcamento_detalhado', 'Orçamento detalhado', 'Memória de cálculo do valor estimado.', 1, 20),
  ('cotacoes', 'Cotações de fornecedores', 'Mínimo de 2 cotações (quando aplicável).', 2, 30),
  ('parecer_area', 'Parecer da área', 'Justificativa e endosso da área solicitante.', 2, 40),
  ('analise_risco', 'Análise de risco', 'Riscos, mitigação e impactos.', 2, 50);

-- 2) Add doc_type_id to project_documents (nullable for legacy)
ALTER TABLE public.project_documents
  ADD COLUMN doc_type_id uuid REFERENCES public.required_document_types(id) ON DELETE SET NULL;

CREATE INDEX idx_project_documents_doc_type_id ON public.project_documents(doc_type_id);
CREATE INDEX idx_project_documents_project_id ON public.project_documents(project_id);

-- 3) Realized amount on disbursements (planejado vs realizado)
ALTER TABLE public.disbursements
  ADD COLUMN realized_amount numeric;

-- 4) Helper: missing required doc types for a project up to a given stage
CREATE OR REPLACE FUNCTION public.missing_required_docs(p_project_id uuid, p_stage int DEFAULT 2)
RETURNS TABLE(id uuid, key text, label text, required_for_stage int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rdt.id, rdt.key, rdt.label, rdt.required_for_stage
    FROM public.required_document_types rdt
   WHERE rdt.active = true
     AND rdt.required_for_stage <= p_stage
     AND NOT EXISTS (
       SELECT 1 FROM public.project_documents pd
        WHERE pd.project_id = p_project_id
          AND pd.doc_type_id = rdt.id
     )
   ORDER BY rdt.sort_order, rdt.label
$$;

GRANT EXECUTE ON FUNCTION public.missing_required_docs(uuid, int) TO authenticated;
