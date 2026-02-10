// Dictionary
export interface DictionaryType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  entry_count: number;
  created_at: string;
  updated_at: string;
}

export interface DictionaryEntry {
  id: number;
  dict_type_id: number;
  code: string | null;
  label: string;
  description: string | null;
  numeric_value: number | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface DictionaryTypeWithEntries {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
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

// Security Area (legacy alias)
export interface SecurityArea {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

// Security Domain (replaces SecurityArea)
export interface SecurityDomain {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  owner: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  cis_controls: { cis_control_id: number; control_number: number | null; name_pl: string | null }[];
  risk_count: number;
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

// Asset
export interface Asset {
  id: number;
  name: string;
  asset_type_id: number | null;
  asset_type_name: string | null;
  category_id: number | null;
  category_name: string | null;
  org_unit_id: number | null;
  org_unit_name: string | null;
  parent_id: number | null;
  parent_name: string | null;
  owner: string | null;
  description: string | null;
  location: string | null;
  sensitivity_id: number | null;
  sensitivity_name: string | null;
  criticality_id: number | null;
  criticality_name: string | null;
  is_active: boolean;
  risk_count: number;
  created_at: string;
  updated_at: string;
}

// Asset Relationships
export interface AssetRelationship {
  id: number;
  source_asset_id: number;
  source_asset_name: string | null;
  target_asset_id: number;
  target_asset_name: string | null;
  relationship_type: string;
  description: string | null;
  created_at: string;
}

export interface AssetGraphNode {
  id: number;
  name: string;
  asset_type_name: string | null;
  criticality_name: string | null;
  org_unit_name: string | null;
  risk_count: number;
}

export interface AssetGraphEdge {
  id: number;
  source: number;
  target: number;
  type: string;
  description: string | null;
}

export interface AssetGraph {
  nodes: AssetGraphNode[];
  edges: AssetGraphEdge[];
}

// Linked Action (shown in risk detail)
export interface LinkedActionRef {
  action_id: number;
  title: string;
  status_name: string | null;
  owner: string | null;
  due_date: string | null;
  is_overdue: boolean;
}

// Risk
export interface Risk {
  id: number;
  code: string;
  // Kontekst
  org_unit_id: number;
  org_unit_name: string;
  risk_category_id: number | null;
  risk_category_name: string | null;
  risk_source: string | null;
  // Identyfikacja aktywa
  asset_id: number | null;
  asset_id_name: string | null;
  asset_name: string;
  asset_category_id: number | null;
  asset_category_name: string | null;
  sensitivity_id: number | null;
  sensitivity_name: string | null;
  criticality_id: number | null;
  criticality_name: string | null;
  security_area_id: number;
  security_area_name: string;
  threat_id: number | null;
  threat_name: string | null;
  vulnerability_id: number | null;
  vulnerability_name: string | null;
  existing_controls: string | null;
  control_effectiveness_id: number | null;
  control_effectiveness_name: string | null;
  consequence_description: string | null;
  // Analiza ryzyka
  impact_level: number;
  probability_level: number;
  safeguard_rating: number;
  risk_score: number;
  risk_level: string;
  // Postepowanie z ryzykiem
  status_id: number | null;
  status_name: string | null;
  strategy_id: number | null;
  strategy_name: string | null;
  owner: string | null;
  planned_actions: string | null;
  treatment_plan: string | null;
  treatment_deadline: string | null;
  treatment_resources: string | null;
  residual_risk: number | null;
  target_impact: number | null;
  target_probability: number | null;
  target_safeguard: number | null;
  // Akceptacja
  accepted_by: string | null;
  accepted_at: string | null;
  acceptance_justification: string | null;
  // Monitorowanie
  next_review_date: string | null;
  identified_at: string | null;
  last_review_at: string | null;
  is_active: boolean;
  safeguard_ids: number[];
  safeguards: { safeguard_id: number; safeguard_name: string }[];
  linked_actions: LinkedActionRef[];
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
  control_number: number;
  name_pl: string;
  name_en: string;
  sub_control_count: number;
  sub_controls: CisSubControl[];
}

export interface CisSubControl {
  id: number;
  control_id: number;
  sub_id: string;
  detail_en: string;
  detail_pl: string | null;
  nist_csf: string | null;
  implementation_groups: string | null;
  sensor_baseline: string | null;
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

// Action
export interface ActionLink {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string | null;
  created_at: string;
}

export interface ActionHistory {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Action {
  id: number;
  title: string;
  description: string | null;
  org_unit_id: number | null;
  org_unit_name: string | null;
  owner: string | null;
  responsible: string | null;
  priority_id: number | null;
  priority_name: string | null;
  status_id: number | null;
  status_name: string | null;
  source_id: number | null;
  source_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  effectiveness_rating: number | null;
  effectiveness_notes: string | null;
  is_active: boolean;
  is_overdue: boolean;
  links: ActionLink[];
  history: ActionHistory[];
  created_at: string;
  updated_at: string;
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

// ═══ Domain Dashboard ═══
export interface DomainTopRisk {
  id: number;
  asset_name: string;
  risk_score: number;
  risk_level: string;
  org_unit_name: string | null;
}

export interface DomainScoreCard {
  domain_id: number;
  domain_name: string;
  icon: string | null;
  color: string | null;
  owner: string | null;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  risk_count: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  avg_risk_score: number | null;
  cis_pct: number | null;
  cis_control_count: number;
  top_risks: DomainTopRisk[];
}

export interface DomainDashboard {
  org_unit_id: number | null;
  org_unit_name: string | null;
  domains: DomainScoreCard[];
  overall_score: number;
  overall_grade: "A" | "B" | "C" | "D" | "F";
}
