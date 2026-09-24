ALTER TABLE public.vocabulary_vault
ADD COLUMN IF NOT EXISTS target_level INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_vocabulary_vault_target_level ON public.vocabulary_vault (target_level);
