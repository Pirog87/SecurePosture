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
  impact_level: number;
  probability_level: number;
  safeguard_rating: number;
  risk_score: number;
  risk_level: string;
  status_id: number | null;
  status_name: string | null;
  strategy_id: number | null;
  strategy_name: string | null;
  owner: string | null;
  planned_actions: string | null;
  residual_risk: number | null;
  identified_at: string | null;
  last_review_at: string | null;
  is_active: boolean;
  safeguard_ids: number[];
  safeguards: { safeguard_id: number; safeguard_name: string }[];
  created_at: string;
  updated_at: string;
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
  assessor_id: number | null;
  assessor_name: string | null;
  status_id: number | null;
  status_name: string | null;
  assessment_date: string;
  maturity_rating: number | null;
  risk_addressed_pct: number | null;
  ig1_score: number | null;
  ig2_score: number | null;
  ig3_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

// ═══ Dashboard: Executive Summary ═══
export interface OrgUnitRef {
  id: number;
  name: string;
  symbol: string;
}

export interface KpiItem {
  label: string;
  value: number | string;
  unit: string | null;
  trend: "up" | "down" | "stable" | null;
  color: string | null;
}

export interface RiskCounts {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface TopRisk {
  id: number;
  asset_name: string;
  risk_score: number;
  risk_level: string;
  org_unit: string;
  security_area: string | null;
  status: string | null;
}

export interface ExecutiveSummary {
  org_unit: OrgUnitRef | null;
  kpis: KpiItem[];
  risk_counts: RiskCounts;
  avg_risk_score: number | null;
  cis_maturity_rating: number | null;
  cis_risk_addressed_pct: number | null;
  posture_score: number | null;
  posture_grade: "A" | "B" | "C" | "D" | "F" | null;
  overdue_reviews_count: number;
  top_risks: TopRisk[];
}

// ═══ Dashboard: Risk Dashboard ═══
export interface RiskByStatus {
  status: string;
  status_color: string | null;
  count: number;
}

export interface RiskByArea {
  area_id: number;
  area_name: string;
  high: number;
  medium: number;
  low: number;
  total: number;
  avg_score: number | null;
}

export interface RiskByOrgUnit {
  org_unit_id: number;
  org_unit_name: string;
  symbol: string;
  high: number;
  medium: number;
  low: number;
  total: number;
  avg_score: number | null;
}

export interface RiskMatrixCell {
  impact: number;
  probability: number;
  count: number;
  risk_ids: number[];
}

export interface RiskTrendPoint {
  period: string;
  high: number;
  medium: number;
  low: number;
  total: number;
  avg_score: number | null;
}

export interface OverdueReviewItem {
  id: number;
  asset_name: string;
  org_unit: string;
  risk_score: number;
  risk_level: string;
  days_since_review: number;
  owner: string | null;
}

export interface RiskDashboard {
  org_unit: OrgUnitRef | null;
  risk_counts: RiskCounts;
  avg_risk_score: number | null;
  by_status: RiskByStatus[];
  by_area: RiskByArea[];
  by_org_unit: RiskByOrgUnit[];
  matrix: RiskMatrixCell[];
  trend: RiskTrendPoint[];
  overdue_reviews: OverdueReviewItem[];
}

// ═══ Dashboard: CIS ═══
export interface CisDimensions {
  policy_pct: number | null;
  implementation_pct: number | null;
  automation_pct: number | null;
  reporting_pct: number | null;
}

export interface CisIgScores {
  ig1: number | null;
  ig2: number | null;
  ig3: number | null;
}

export interface CisControlScore {
  control_number: number;
  name_pl: string;
  name_en: string;
  applicable_subs: number;
  na_subs: number;
  risk_addressed_pct: number | null;
  dimensions: CisDimensions;
}

export interface CisAttackCapability {
  activity: string;
  preventive_score: number | null;
  detective_score: number | null;
  preventive_level: "Low" | "Moderate" | "High";
  detective_level: "Low" | "Moderate" | "High";
}

export interface CisDashboard {
  org_unit: OrgUnitRef | null;
  assessment_id: number | null;
  assessment_date: string | null;
  maturity_rating: number | null;
  risk_addressed_pct: number | null;
  overall_dimensions: CisDimensions;
  ig_scores: CisIgScores;
  controls: CisControlScore[];
  attack_capabilities: CisAttackCapability[];
}

// ═══ Dashboard: Posture Score ═══
export interface PostureDimension {
  name: string;
  score: number;
  weight: number;
  color: string | null;
}

export interface PostureScoreResponse {
  org_unit: OrgUnitRef | null;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  dimensions: PostureDimension[];
  benchmark_avg: number | null;
}

// ═══ Dashboard: CIS Comparison ═══
export interface CisComparisonUnit {
  org_unit: OrgUnitRef | null;
  assessment_id: number | null;
  assessment_date: string | null;
  maturity_rating: number | null;
  risk_addressed_pct: number | null;
  ig_scores: CisIgScores;
  controls: CisControlScore[];
}

export interface CisComparison {
  units: CisComparisonUnit[];
}

// ═══ Dashboard: CIS Trend ═══
export interface CisTrendPoint {
  assessment_id: number;
  assessment_date: string;
  maturity_rating: number | null;
  risk_addressed_pct: number | null;
  ig1: number | null;
  ig2: number | null;
  ig3: number | null;
}

export interface CisTrend {
  org_unit: OrgUnitRef | null;
  points: CisTrendPoint[];
}
