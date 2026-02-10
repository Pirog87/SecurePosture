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
import AuditPage from "./pages/AuditPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="assets" element={<AssetRegistryPage />} />
          <Route path="risks" element={<RisksPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="cis" element={<CisListPage />} />
          <Route path="cis/assess" element={<CisAssessPage />} />
          <Route path="org-structure" element={<OrgStructurePage />} />
          <Route path="catalogs" element={<CatalogsPage />} />
          <Route path="dictionaries" element={<DictionariesPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
