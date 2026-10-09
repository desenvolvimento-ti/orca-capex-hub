-- Onda A (parte 1) — apenas adiciona novos valores ao enum project_status.
-- Postgres exige que novos enum values sejam committed antes de usá-los em UPDATEs.
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'no_ciclo';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'em_pre_analise_fpa';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'aguardando_diretoria_prev';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'devolvido_pre';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'nao_aprovado_pre';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'aguardando_documentacao';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'em_analise_fpa_orc';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'aguardando_diretoria_final';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'devolvido_orc';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'aprovado_final';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'reprovado_final';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'em_execucao';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'concluido';