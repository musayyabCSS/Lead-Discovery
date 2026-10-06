export interface IcpConfig {
  id: string;
  name: string;
  owner_business: 'CSS' | 'Med Bills';
  target_verticals: string[];
  exclusions: string[];
  company_size_stage: string;
  kdm_titles: string[];
  geography: string;
  signal_rotation: Record<string, string>;
  email_requirement: string;
  scoring_bands: {
    strong?: number[];
    qualified?: number[];
    borderline?: number[];
    reject_below?: number;
  };
  is_active: boolean;
  created_at: string;
}

export interface Run {
  id: string;
  icp_config_id: string;
  triggered_by: 'manual' | 'scheduled';
  status: 'running' | 'complete' | 'failed';
  started_at: string;
  finished_at: string | null;
  leads_found: number;
  leads_qualified: number;
  signals_found: number;
  candidates_found: number;
  icp_config?: IcpConfig;
}

export interface Signal {
  id: string;
  run_id: string;
  signal_type: string;
  source_url: string;
  raw_snippet: string;
  discovered_company_name: string;
  is_candidate: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  run_id: string;
  icp_config_id: string;
  company_name: string;
  contact_name: string;
  contact_title: string;
  email: string;
  email_verified: boolean;
  email_verification_status: string;
  source_signal_id: string | null;
  confidence_score: number;
  score_reasoning: string;
  qualification_status: 'pending_review' | 'approved' | 'rejected' | 'duplicate';
  reviewed_by: string | null;
  reviewed_at: string | null;
  exported_to_sheet: boolean;
  created_at: string;
  icp_config?: IcpConfig;
  signal?: Signal;
}
