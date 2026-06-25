-- Migration: adicionar tabela pacientes
-- Execute no Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS public.pacientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  external_id   TEXT,                    -- "local_123" — chave de idempotência
  nome          TEXT NOT NULL,
  cpf           TEXT,
  nascimento    DATE,
  telefone      TEXT,
  email         TEXT,
  convenio      TEXT,
  status        TEXT NOT NULL DEFAULT 'ativo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Garante que o mesmo registro local não seja inserido duas vezes
  UNIQUE (empresa_id, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacientes TO authenticated;
GRANT ALL ON public.pacientes TO service_role;

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes da empresa" ON public.pacientes
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE INDEX ON public.pacientes (empresa_id, created_at DESC);

-- Índice no external_id para o upsert ser rápido
CREATE INDEX ON public.pacientes (empresa_id, external_id);

-- Tabela de logs já existe no schema original.
-- Confirme que logs_sincronizacao existe — se não, crie:
CREATE TABLE IF NOT EXISTS public.logs_sincronizacao (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'sucesso',
  mensagem    TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs_sincronizacao TO authenticated;
GRANT ALL ON public.logs_sincronizacao TO service_role;

ALTER TABLE public.logs_sincronizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logs da empresa" ON public.logs_sincronizacao
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());
