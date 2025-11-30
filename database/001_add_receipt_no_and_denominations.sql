-- Migration: Add receipt_no and missing denomination columns to payments_in table
-- Date: 2025-11-29

-- Add receipt_no column to payments_in
ALTER TABLE public.payments_in
ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(100);

-- Add missing denomination columns to payments_in
ALTER TABLE public.payments_in
ADD COLUMN IF NOT EXISTS denomination_10 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS denomination_20 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS denomination_50 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS denomination_100 INTEGER DEFAULT 0;

-- Create index on receipt_no for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_in_receipt_no ON public.payments_in USING btree (receipt_no);

-- Add receipt_no column to payments_out (for consistency)
ALTER TABLE public.payments_out
ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(100);

-- Add missing denomination columns to payments_out
ALTER TABLE public.payments_out
ADD COLUMN IF NOT EXISTS denomination_10 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS denomination_20 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS denomination_50 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS denomination_100 INTEGER DEFAULT 0;

-- Create index on receipt_no for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_out_receipt_no ON public.payments_out USING btree (receipt_no);
