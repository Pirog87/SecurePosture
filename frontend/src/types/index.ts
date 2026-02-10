// Dictionary
export interface DictionaryType {
  id: number;
  code: string;
  name: string;
  is_system: boolean;
}

export interface DictionaryEntry {
  id: number;
  dictionary_type_id: number;
  label: string;
  numeric_value: number | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface DictionaryTypeWithEntries extends DictionaryType {
  entries: DictionaryEntry[];
}

// Org Unit
export interface OrgLevel {
  id: number;
  level_number: number;
  name: string;
}

export interface OrgUnit {
  id: number;
  parent_id: number | null;
  level_id: number;
  name: string;
  symbol: string;
  owner: string | null;
  security_contact: string | null;
  description: string | null;
  is_active: boolean;
  deactivated_at: string | null;
}

export interface OrgUnitTreeNode extends OrgUnit {
  level_name: string;
  children: OrgUnitTreeNode[];
}

// Security Area
export interface SecurityArea {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

// Catalog
export interface Threat {
  id: number;
  name: string;
  category_id: number | null;
  category_name: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Vulnerability {
  id: number;
  name: string;
  security_area_id: number | null;
  security_area_name: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Safeguard {
  id: number;
  name: string;
  type_id: number | null;
  type_name: string | null;
  description: string | null;
  is_active: boolean;
}

// Risk
export interface Risk {
  id: number;
  code: string;
  org_unit_id: number;
  org_unit_name: string;
  security_area_id: number;
  security_area_name: string;
  asset_name: string;
  asset_category_id: number | null;
  asset_category_name: string | null;
  sensitivity_id: number | null;
  sensitivity_name: string | null;
  criticality_id: number | null;
  criticality_name: string | null;
  threat_id: number | null;
  threat_name: string | null;
  vulnerability_id: number | null;
  vulnerability_name: string | null;
  impact_w: number;
  probability_p: number;
  safeguard_rating_z: number;
  risk_score: number;
  risk_level: string;
  status_id: number | null;
  status_name: string | null;
  strategy_id: number | null;
  strategy_name: string | null;
  owner: string | null;
  planned_actions: string | null;
  is_active: boolean;
  safeguard_ids: number[];
}

// Risk Review
export interface RiskReview {
  id: number;
  risk_id: number;
  reviewer: string | null;
  notes: string | null;
  created_at: string;
}

export interface OverdueRisk {
  risk_id: number;
  code: string;
  asset_name: string;
  org_unit_name: string;
  last_review_at: string | null;
  days_since_review: number;
}

// CIS
export interface CisControl {
  id: number;
  number: number;
  name_pl: string;
  name_en: string;
  sub_controls: CisSubControl[];
}

export interface CisSubControl {
  id: number;
  control_id: number;
  number: string;
  name_pl: string | null;
  name_en: string | null;
  ig1: boolean;
  ig2: boolean;
  ig3: boolean;
}

export interface CisAssessment {
  id: number;
  org_unit_id: number | null;
  org_unit_name: string | null;
  assessor: string | null;
  assessment_date: string;
  status: string;
  maturity_rating: number | null;
  risk_addressed_pct: number | null;
  notes: string | null;
}

export interface CisAnswer {
  id: number;
  assessment_id: number;
  sub_control_id: number;
  policy_value: number;
  implemented_value: number;
  automated_value: number;
  reported_value: number;
  is_not_applicable: boolean;
}

// Audit
export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  module: string;
  action: string;
  entity_type: string;
  entity_id: number;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  per_page: number;
}

// Dashboard
export interface ExecutiveSummary {
  overall_score: number;
  total_risks: number;
  high_risks: number;
  medium_risks: number;
  low_risks: number;
  cis_maturity_avg: number;
  overdue_reviews: number;
}
