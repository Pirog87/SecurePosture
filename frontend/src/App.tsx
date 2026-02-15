import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardPage from "./pages/DashboardPage";
import RisksPage from "./pages/RisksPage";
import ReviewsPage from "./pages/ReviewsPage";

import DictionariesPage from "./pages/DictionariesPage";
import AssetRegistryPage from "./pages/AssetRegistryPage";
import AssetsPage from "./pages/AssetsPage";
import ActionsPage from "./pages/ActionsPage";
import AuditPage from "./pages/AuditPage";
import DomainDashboardPage from "./pages/DomainDashboardPage";
import FrameworksPage from "./pages/FrameworksPage";
import FrameworkDetailPage from "./pages/FrameworkDetailPage";
import AssessmentsPage from "./pages/AssessmentsPage";
import AssessmentFormPage from "./pages/AssessmentFormPage";
import VulnerabilitiesPage from "./pages/VulnerabilitiesPage";
import IncidentsPage from "./pages/IncidentsPage";

import ExceptionsPage from "./pages/ExceptionsPage";
import AuditsPage from "./pages/AuditsPage";
import VendorsPage from "./pages/VendorsPage";
import AwarenessPage from "./pages/AwarenessPage";
import SecurityScorePage from "./pages/SecurityScorePage";
import OrgContextPage from "./pages/OrgContextPage";
import CmdbAdminPage from "./pages/CmdbAdminPage";
import ReportsPage from "./pages/ReportsPage";
import SmartCatalogPage from "./pages/SmartCatalogPage";
import AIConfigPage from "./pages/AIConfigPage";
import DatabaseAdminPage from "./pages/DatabaseAdminPage";
import ControlEffectivenessPage from "./pages/ControlEffectivenessPage";

// Compliance & Audit module
import ComplianceDashboardPage from "./pages/ComplianceDashboardPage";
import ComplianceAssessmentsPage from "./pages/ComplianceAssessmentsPage";
import ComplianceAssessmentFormPage from "./pages/ComplianceAssessmentFormPage";
import AuditProgramsPage from "./pages/AuditProgramsPage";
import AuditEngagementsPage from "./pages/AuditEngagementsPage";
import AuditEngagementDetailPage from "./pages/AuditEngagementDetailPage";
import FrameworkMappingsPage from "./pages/FrameworkMappingsPage";
import TestTemplatesPage from "./pages/TestTemplatesPage";
import AuditFindingsPage from "./pages/AuditFindingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="security-score" element={<SecurityScorePage />} />
          <Route path="domains" element={<DomainDashboardPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/legacy" element={<AssetRegistryPage />} />
          <Route path="assets/graph" element={<Navigate to="/assets" replace />} />
          <Route path="assets/admin" element={<CmdbAdminPage />} />
          <Route path="risks" element={<RisksPage />} />
          <Route path="reviews" element={<ReviewsPage />} />

          {/* Framework Library (kept at /frameworks for backward compat) */}
          <Route path="frameworks" element={<FrameworksPage />} />
          <Route path="frameworks/:fwId" element={<FrameworkDetailPage />} />

          {/* Legacy dimension-based assessments (existing Framework Engine) */}
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="assessments/new" element={<AssessmentsPage />} />
          <Route path="assessments/:assessmentId" element={<AssessmentFormPage />} />

          {/* Compliance & Audit module — new */}
          <Route path="compliance" element={<ComplianceDashboardPage />} />
          <Route path="compliance/assessments" element={<ComplianceAssessmentsPage />} />
          <Route path="compliance/assessments/:assessmentId" element={<ComplianceAssessmentFormPage />} />
          <Route path="framework-mappings" element={<FrameworkMappingsPage />} />
          <Route path="audit-programs" element={<AuditProgramsPage />} />
          <Route path="audit-engagements" element={<AuditEngagementsPage />} />
          <Route path="audit-engagements/:engId" element={<AuditEngagementDetailPage />} />
          <Route path="test-templates" element={<TestTemplatesPage />} />
          <Route path="audit-findings" element={<AuditFindingsPage />} />

          {/* Legacy CIS routes — redirect to framework library */}
          <Route path="cis" element={<Navigate to="/frameworks" replace />} />
          <Route path="cis/assess" element={<Navigate to="/compliance/assessments" replace />} />

          <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="policies" element={<Navigate to="/frameworks?origin=internal&type=polityka_wewnetrzna" replace />} />
          <Route path="exceptions" element={<ExceptionsPage />} />
          <Route path="audits" element={<AuditsPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="awareness" element={<AwarenessPage />} />
          <Route path="org-context" element={<OrgContextPage />} />
          <Route path="org-structure" element={<Navigate to="/org-context" replace />} />
          <Route path="smart-catalog" element={<SmartCatalogPage />} />
          <Route path="control-effectiveness" element={<ControlEffectivenessPage />} />
          <Route path="ai-config" element={<AIConfigPage />} />
          <Route path="db-admin" element={<DatabaseAdminPage />} />
          <Route path="catalogs" element={<Navigate to="/smart-catalog" replace />} />
          <Route path="dictionaries" element={<DictionariesPage />} />
          <Route path="actions" element={<ActionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
