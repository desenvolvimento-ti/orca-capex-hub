
-- Allow managers to delete their own projects only in early statuses
CREATE POLICY "projects_delete_owner_early" ON public.projects
FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  AND status IN ('no_hub'::project_status, 'rascunho'::project_status, 'submetido_intake'::project_status)
);

-- Add cycle end date column (signals the final deadline for pre-approved project workflows)
ALTER TABLE public.cycles ADD COLUMN IF NOT EXISTS cycle_end_date timestamptz;
