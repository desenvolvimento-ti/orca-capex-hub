
TRUNCATE TABLE
  public.disbursements,
  public.project_status_history,
  public.project_comments,
  public.project_documents,
  public.projects,
  public.windows,
  public.cycles
RESTART IDENTITY CASCADE;

ALTER SEQUENCE public.project_seq RESTART WITH 1;
