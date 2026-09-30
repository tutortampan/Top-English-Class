-- Migration: 20260930_vault_theme.sql
-- Description: Adds 'theme' column to vocabulary_vault table for auto-split importer logic

ALTER TABLE public.vocabulary_vault
ADD COLUMN IF NOT EXISTS theme text;

CREATE INDEX IF NOT EXISTS idx_vocabulary_vault_theme ON public.vocabulary_vault (theme);
