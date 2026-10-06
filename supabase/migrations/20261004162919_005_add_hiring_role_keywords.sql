/*
# Add hiring_role_keywords to icp_configs

1. Modified Tables
- `icp_configs`: add `hiring_role_keywords` (jsonb, nullable) — stores an array of role-keyword
  strings per ICP config, used by the run-discovery edge function to build targeted hiring queries
  and to filter results that don't mention any of the target roles.

2. Data
- Seed Med Bills with: ["front desk", "receptionist", "patient coordinator", "medical biller",
  "billing specialist", "scheduler", "medical scribe", "revenue cycle"]
- Seed CSS with: ["customer support", "customer service", "support specialist",
  "support manager", "customer experience"]

3. Security
- No changes to RLS or existing policies.
*/

ALTER TABLE public.icp_configs
  ADD COLUMN IF NOT EXISTS hiring_role_keywords jsonb DEFAULT NULL;

UPDATE public.icp_configs
  SET hiring_role_keywords = '["front desk", "receptionist", "patient coordinator", "medical biller", "billing specialist", "scheduler", "medical scribe", "revenue cycle"]'::jsonb
  WHERE name = 'Med Bills';

UPDATE public.icp_configs
  SET hiring_role_keywords = '["customer support", "customer service", "support specialist", "support manager", "customer experience"]'::jsonb
  WHERE name = 'CSS';
