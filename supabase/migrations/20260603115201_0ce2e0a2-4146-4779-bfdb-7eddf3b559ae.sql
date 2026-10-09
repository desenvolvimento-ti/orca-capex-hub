
-- Fix 1: Restrict INSERTs on project_status_history to users who can access the referenced project
DROP POLICY IF EXISTS history_insert_any_authenticated ON public.project_status_history;

CREATE POLICY history_insert_via_project
ON public.project_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_status_history.project_id
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

-- Fix 2: Tighten storage SELECT on project-docs to mirror project_documents access rules
DROP POLICY IF EXISTS project_docs_read ON storage.objects;

CREATE POLICY project_docs_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-docs'
  AND EXISTS (
    SELECT 1
    FROM public.project_documents d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.file_path = storage.objects.name
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

-- Fix 3: Add an explicit deny-by-omission record for allowed_emails by ensuring anon has no privilege
REVOKE ALL ON public.allowed_emails FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_emails TO authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
