import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import DashboardPage from "./pages/DashboardPage";
import RisksPage from "./pages/RisksPage";
import ReviewsPage from "./pages/ReviewsPage";
import CisListPage from "./pages/CisListPage";
import CisAssessPage from "./pages/CisAssessPage";
import OrgStructurePage from "./pages/OrgStructurePage";
import CatalogsPage from "./pages/CatalogsPage";
import DictionariesPage from "./pages/DictionariesPage";
import AssetRegistryPage from "./pages/AssetRegistryPage";
import AssetGraphPage from "./pages/AssetGraphPage";
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="domains" element={<DomainDashboardPage />} />
          <Route path="assets" element={<AssetRegistryPage />} />
          <Route path="assets/graph" element={<AssetGraphPage />} />
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
          <Route path="cis" element={<CisListPage />} />
          <Route path="cis/assess" element={<CisAssessPage />} />
          <Route path="org-structure" element={<OrgStructurePage />} />
          <Route path="catalogs" element={<CatalogsPage />} />
          <Route path="dictionaries" element={<DictionariesPage />} />
          <Route path="actions" element={<ActionsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
