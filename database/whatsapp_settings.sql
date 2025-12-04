-- WhatsApp Settings Table
-- Stores WhatsApp connection settings and message templates

-- Add WhatsApp related columns to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS whatsapp_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_phone_number character varying(20) NULL,
ADD COLUMN IF NOT EXISTS whatsapp_connected_at timestamp without time zone NULL,

-- Auto-send settings
ADD COLUMN IF NOT EXISTS whatsapp_auto_send_sales boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_auto_send_purchase boolean DEFAULT false,

-- Message templates
ADD COLUMN IF NOT EXISTS whatsapp_sales_message_template text DEFAULT 'Dear Sir, Aslam-o-Alaikam!
Please see the new Invoice.
{Transaction_Date}
{Party_Name}

Invoice #  {Invoice_No}
Inv. Amount  {Invoice_Amount} /-
Current Total Balance= {Party_Balance}
========================
Thanks
{Company_Name}
{Company_Phone}',

ADD COLUMN IF NOT EXISTS whatsapp_purchase_message_template text DEFAULT 'Dear Sir, Aslam-o-Alaikam!
Please see the new Purchase Order.
{Transaction_Date}
{Party_Name}

PO #  {PO_No}
Amount  {PO_Amount} /-
Current Total Balance= {Party_Balance}
========================
Thanks
{Company_Name}
{Company_Phone}',

-- Attach image settings
ADD COLUMN IF NOT EXISTS whatsapp_attach_invoice_image boolean DEFAULT true;


-- WhatsApp Session Table (stores session data for persistence)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id serial NOT NULL,
  user_id integer NOT NULL,
  session_data text NULL,
  is_connected boolean DEFAULT false,
  phone_number character varying(20) NULL,
  connected_at timestamp without time zone NULL,
  last_activity timestamp without time zone NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_sessions_user_id_key UNIQUE (user_id),
  CONSTRAINT whatsapp_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON public.whatsapp_sessions USING btree (user_id) TABLESPACE pg_default;


-- WhatsApp Message Log Table (tracks sent messages)
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id serial NOT NULL,
  user_id integer NOT NULL,
  transaction_type character varying(50) NOT NULL, -- 'sales_invoice', 'purchase_order', etc.
  transaction_id integer NOT NULL,
  recipient_phone character varying(20) NOT NULL,
  recipient_name character varying(255) NULL,
  message_content text NOT NULL,
  attachment_sent boolean DEFAULT false,
  status character varying(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  error_message text NULL,
  sent_at timestamp without time zone NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT whatsapp_message_logs_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_message_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user_id ON public.whatsapp_message_logs USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_transaction ON public.whatsapp_message_logs USING btree (transaction_type, transaction_id) TABLESPACE pg_default;
