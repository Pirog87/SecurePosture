import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardPage from "./pages/DashboardPage";
import RisksPage from "./pages/RisksPage";
import ReviewsPage from "./pages/ReviewsPage";
import CisListPage from "./pages/CisListPage";
import CisAssessPage from "./pages/CisAssessPage";

import CatalogsPage from "./pages/CatalogsPage";
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
import PoliciesPage from "./pages/PoliciesPage";
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
          <Route path="frameworks" element={<FrameworksPage />} />
          <Route path="frameworks/:fwId" element={<FrameworkDetailPage />} />
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="assessments/new" element={<AssessmentsPage />} />
          <Route path="assessments/:assessmentId" element={<AssessmentFormPage />} />
          <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="exceptions" element={<ExceptionsPage />} />
          <Route path="audits" element={<AuditsPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="awareness" element={<AwarenessPage />} />
          <Route path="cis" element={<CisListPage />} />
          <Route path="cis/assess" element={<CisAssessPage />} />
          <Route path="org-context" element={<OrgContextPage />} />
          <Route path="org-structure" element={<Navigate to="/org-context" replace />} />
          <Route path="smart-catalog" element={<SmartCatalogPage />} />
          <Route path="ai-config" element={<AIConfigPage />} />
          <Route path="catalogs" element={<CatalogsPage />} />
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
