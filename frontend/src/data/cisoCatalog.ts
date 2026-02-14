/**
 * CISO Assistant Community — catalog of available mapping files and frameworks.
 * Source: https://github.com/intuitem/ciso-assistant-community/tree/main/backend/library/libraries
 */

/* ─── Mapping Files ─── */

export interface MappingFileInfo {
  filename: string;
  source: string;
  target: string;
  /** "to" = directional, "and" = bidirectional */
  direction: "to" | "and";
}

export const CISO_MAPPING_FILES: MappingFileInfo[] = [
  { filename: "mapping-adobe-ccf-v5-and-bsi-c5-2020.yaml", source: "Adobe CCF v5", target: "BSI C5 2020", direction: "and" },
  { filename: "mapping-adobe-ccf-v5-and-cyber_essentials_requirements_for_it_infrastructure.yaml", source: "Adobe CCF v5", target: "Cyber Essentials", direction: "and" },
  { filename: "mapping-adobe-ccf-v5-and-fedramp-rev5.yaml", source: "Adobe CCF v5", target: "FedRAMP Rev5", direction: "and" },
  { filename: "mapping-adobe-ccf-v5-and-iso27001-2022.yaml", source: "Adobe CCF v5", target: "ISO 27001:2022", direction: "and" },
  { filename: "mapping-adobe-ccf-v5-and-nist-csf-1.1.yaml", source: "Adobe CCF v5", target: "NIST CSF 1.1", direction: "and" },
  { filename: "mapping-adobe-ccf-v5-and-pcidss-4_0.yaml", source: "Adobe CCF v5", target: "PCI DSS 4.0", direction: "and" },
  { filename: "mapping-adobe-ccf-v5-and-soc2-2017-rev-2022.yaml", source: "Adobe CCF v5", target: "SOC2 2017", direction: "and" },
  { filename: "mapping-annex-technical-and-methodological-requirements-nis2-and-ccb-cff-2023-03-01.yaml", source: "NIS2 Annex", target: "CCB CFF 2023", direction: "and" },
  { filename: "mapping-annex-technical-and-methodological-requirements-nis2-and-iso27001-2022.yaml", source: "NIS2 Annex", target: "ISO 27001:2022", direction: "and" },
  { filename: "mapping-annex-technical-and-methodological-requirements-nis2-and-nist-csf-2.0.yaml", source: "NIS2 Annex", target: "NIST CSF 2.0", direction: "and" },
  { filename: "mapping-ccb-cff-2023-03-01-and-ccb-cyfun2025.yaml", source: "CCB CFF 2023", target: "CCB CyFun 2025", direction: "and" },
  { filename: "mapping-ccb-cff-2023-03-01-to-iso27001-2022.yaml", source: "CCB CFF 2023", target: "ISO 27001:2022", direction: "to" },
  { filename: "mapping-cis-controls-v8-and-iso27001-2022.yaml", source: "CIS Controls v8", target: "ISO 27001:2022", direction: "and" },
  { filename: "mapping-cis-controls-v8-and-scf-2025.2.2.yaml", source: "CIS Controls v8", target: "SCF 2025.2.2", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-bsi-c5-2020.yaml", source: "Cisco CCF v3.0", target: "BSI C5 2020", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-esquema-nacional-de-seguridad.yaml", source: "Cisco CCF v3.0", target: "ENS", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-fedramp-rev5.yaml", source: "Cisco CCF v3.0", target: "FedRAMP Rev5", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-iso27001-2022.yaml", source: "Cisco CCF v3.0", target: "ISO 27001:2022", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-ncsc-caf-3.2.yaml", source: "Cisco CCF v3.0", target: "NCSC CAF 3.2", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-nist-800-171-rev2.yaml", source: "Cisco CCF v3.0", target: "NIST 800-171 Rev2", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-nist-800-171-rev3.yaml", source: "Cisco CCF v3.0", target: "NIST 800-171 Rev3", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-nist-ssdf-1.1.yaml", source: "Cisco CCF v3.0", target: "NIST SSDF 1.1", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-pcidss-4_0.yaml", source: "Cisco CCF v3.0", target: "PCI DSS 4.0", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-secnumcloud-3.2.yaml", source: "Cisco CCF v3.0", target: "SecNumCloud 3.2", direction: "and" },
  { filename: "mapping-cisco-ccf-v3.0-and-soc2-2017-rev-2022.yaml", source: "Cisco CCF v3.0", target: "SOC2 2017", direction: "and" },
  { filename: "mapping-cjis-policy-5.9.4-to-cjis-policy-5.9.yaml", source: "CJIS 5.9.4", target: "CJIS 5.9", direction: "to" },
  { filename: "mapping-dora-and-finma-2023-01.yaml", source: "DORA", target: "FINMA 2023-01", direction: "and" },
  { filename: "mapping-india-dpdpa-2023-and-scf-2025.2.2.yaml", source: "India DPDPA 2023", target: "SCF 2025.2.2", direction: "and" },
  { filename: "mapping-iso27001-2013-to-iso27001-2022.yaml", source: "ISO 27001:2013", target: "ISO 27001:2022", direction: "to" },
  { filename: "mapping-iso27001-2022-and-scf-2025.2.2.yaml", source: "ISO 27001:2022", target: "SCF 2025.2.2", direction: "and" },
  { filename: "mapping-iso27001-2022-to-secnumcloud-3.2.yaml", source: "ISO 27001:2022", target: "SecNumCloud 3.2", direction: "to" },
  { filename: "mapping-iso42001-2023-and-scf-2025.2.2.yaml", source: "ISO 42001:2023", target: "SCF 2025.2.2", direction: "and" },
  { filename: "mapping-nist-csf-2.0-and-scf-2025.2.2.yaml", source: "NIST CSF 2.0", target: "SCF 2025.2.2", direction: "and" },
  { filename: "mapping-nist-csf-2.0-to-iso27001-2022.yaml", source: "NIST CSF 2.0", target: "ISO 27001:2022", direction: "to" },
  { filename: "mapping-nist-sp-800-53-rev5-to-iso27001-2022.yaml", source: "NIST SP 800-53 Rev5", target: "ISO 27001:2022", direction: "to" },
  { filename: "mapping-nist-sp-800-66-rev2-to-nist-csf-1.1.yaml", source: "NIST SP 800-66 Rev2", target: "NIST CSF 1.1", direction: "to" },
  { filename: "mapping-nist-sp-800-66-rev2-to-nist-csf-2.0.yaml", source: "NIST SP 800-66 Rev2", target: "NIST CSF 2.0", direction: "to" },
  { filename: "mapping-nist-sp-800-66-rev2-to-nist-sp-800-53-rev5.yaml", source: "NIST SP 800-66 Rev2", target: "NIST SP 800-53 Rev5", direction: "to" },
  { filename: "mapping-pcidss-4_0-and-scf-2025.2.2.yaml", source: "PCI DSS 4.0", target: "SCF 2025.2.2", direction: "and" },
  { filename: "mapping-scf-2025.2.2-and-swift-cscf-v2025.yaml", source: "SCF 2025.2.2", target: "SWIFT CSCF v2025", direction: "and" },
  { filename: "mapping-secnumcloud-3.2-to-iso27001-2022.yaml", source: "SecNumCloud 3.2", target: "ISO 27001:2022", direction: "to" },
  { filename: "mapping-soc2-2017-rev-2022-and-scf-2025.2.2.yaml", source: "SOC2 2017", target: "SCF 2025.2.2", direction: "and" },
  { filename: "mapping-soc2-2017-rev-2022-to-iso27001-2022.yaml", source: "SOC2 2017", target: "ISO 27001:2022", direction: "to" },
];

/* ─── Framework Catalog ─── */

export type FrameworkCategory = "nist" | "iso" | "cis" | "pci" | "soc" | "gdpr" | "eu" | "cloud" | "ccf" | "other";

export interface CatalogFramework {
  filename: string;
  name: string;
  provider: string;
  category: FrameworkCategory;
}

export const CATEGORY_LABELS: Record<FrameworkCategory, string> = {
  nist: "NIST",
  iso: "ISO",
  cis: "CIS",
  pci: "PCI",
  soc: "SOC",
  gdpr: "GDPR/Privacy",
  eu: "EU/NIS2/DORA",
  cloud: "Cloud",
  ccf: "CCF",
  other: "Inne",
};

export const CATEGORY_COLORS: Record<FrameworkCategory, string> = {
  nist: "#6366f1",
  iso: "#10b981",
  cis: "#f59e0b",
  pci: "#ef4444",
  soc: "#8b5cf6",
  gdpr: "#ec4899",
  eu: "#3b82f6",
  cloud: "#06b6d4",
  ccf: "#14b8a6",
  other: "#94a3b8",
};

export const CISO_FRAMEWORK_CATALOG: CatalogFramework[] = [
  // NIST
  { filename: "nist-sp-800-53-rev5.yaml", name: "NIST SP 800-53 Rev5", provider: "NIST", category: "nist" },
  { filename: "nist-csf-2.0.yaml", name: "NIST CSF 2.0", provider: "NIST", category: "nist" },
  { filename: "nist-csf-1.1.yaml", name: "NIST CSF 1.1", provider: "NIST", category: "nist" },
  { filename: "nist-800-171-rev2.yaml", name: "NIST 800-171 Rev2", provider: "NIST", category: "nist" },
  { filename: "nist-800-171-rev3.yaml", name: "NIST 800-171 Rev3", provider: "NIST", category: "nist" },
  { filename: "nist-sp-800-66-rev2.yaml", name: "NIST SP 800-66 Rev2 (HIPAA)", provider: "NIST", category: "nist" },
  { filename: "nist-ssdf-1.1.yaml", name: "NIST SSDF 1.1", provider: "NIST", category: "nist" },
  { filename: "nist-ai-rmf-1.0.yaml", name: "NIST AI RMF 1.0", provider: "NIST", category: "nist" },
  { filename: "nist-privacy-1.0.yaml", name: "NIST Privacy Framework 1.0", provider: "NIST", category: "nist" },
  { filename: "nist-sp-800-82-annex-f.yaml", name: "NIST SP 800-82 Annex F", provider: "NIST", category: "nist" },
  { filename: "fedramp-rev5.yaml", name: "FedRAMP Rev5", provider: "NIST/GSA", category: "nist" },

  // ISO
  { filename: "iso27001-2022.yaml", name: "ISO 27001:2022", provider: "ISO", category: "iso" },
  { filename: "iso27001-2013.yaml", name: "ISO 27001:2013", provider: "ISO", category: "iso" },
  { filename: "iso22301-2019.yaml", name: "ISO 22301:2019 (BCM)", provider: "ISO", category: "iso" },
  { filename: "iso42001-2023.yaml", name: "ISO 42001:2023 (AI)", provider: "ISO", category: "iso" },

  // CIS
  { filename: "cis-controls-v8.xlsx", name: "CIS Controls v8", provider: "CIS", category: "cis" },
  { filename: "cis-benchmark-kubernetes.yaml", name: "CIS Benchmark Kubernetes", provider: "CIS", category: "cis" },

  // PCI
  { filename: "pcidss-4_0.yaml", name: "PCI DSS 4.0", provider: "PCI SSC", category: "pci" },

  // SOC
  { filename: "soc2-2017-rev-2022.yaml", name: "SOC2 2017 Rev 2022", provider: "AICPA", category: "soc" },

  // GDPR / Privacy
  { filename: "gdpr.yaml", name: "GDPR", provider: "EU", category: "gdpr" },
  { filename: "gdpr-checklist.yaml", name: "GDPR Checklist", provider: "EU", category: "gdpr" },
  { filename: "ccpa_act.yaml", name: "CCPA Act", provider: "California", category: "gdpr" },
  { filename: "ccpa_regulations.yaml", name: "CCPA Regulations", provider: "California", category: "gdpr" },
  { filename: "india-dpdpa-2023.yaml", name: "India DPDPA 2023", provider: "India", category: "gdpr" },

  // EU / NIS2 / DORA
  { filename: "dora.yaml", name: "DORA", provider: "EU", category: "eu" },
  { filename: "annex-nis2-regulation--2024-2690-with-technical-implementation-guidance-by-enisa.yaml", name: "NIS2 Annex (ENISA Technical Guide)", provider: "ENISA", category: "eu" },
  { filename: "ai-act.yaml", name: "EU AI Act", provider: "EU", category: "eu" },
  { filename: "ens-decreto.yaml", name: "ENS (Esquema Nacional de Seguridad)", provider: "Spain", category: "eu" },
  { filename: "esrs-p1.yaml", name: "ESRS Part 1", provider: "EFRAG", category: "eu" },
  { filename: "esrs-p2.yaml", name: "ESRS Part 2", provider: "EFRAG", category: "eu" },
  { filename: "cra-regulation-annexes.yaml", name: "Cyber Resilience Act Annexes", provider: "EU", category: "eu" },
  { filename: "ccb-cff-2023-03-01.yaml", name: "CCB CFF 2023", provider: "CCB Belgium", category: "eu" },
  { filename: "ccb-cyfun2025.yaml", name: "CCB CyFun 2025", provider: "CCB Belgium", category: "eu" },
  { filename: "finma-2023-01.yaml", name: "FINMA 2023-01", provider: "Switzerland", category: "eu" },

  // Cloud
  { filename: "secnumcloud-3.2.yaml", name: "SecNumCloud 3.2", provider: "ANSSI", category: "cloud" },
  { filename: "bsi-c5-2020.yaml", name: "BSI C5 2020", provider: "BSI Germany", category: "cloud" },

  // CCF (Common Controls Frameworks)
  { filename: "adobe-ccf-v5.yaml", name: "Adobe CCF v5", provider: "Adobe", category: "ccf" },
  { filename: "cisco-ccf-v3.0.yaml", name: "Cisco CCF v3.0", provider: "Cisco", category: "ccf" },
  { filename: "scf-2025.2.2.yaml", name: "SCF 2025.2.2", provider: "Secure Controls Framework", category: "ccf" },

  // Other
  { filename: "cmmc-2.0.yaml", name: "CMMC 2.0", provider: "DoD", category: "other" },
  { filename: "owasp-asvs-4.0.3.yaml", name: "OWASP ASVS 4.0.3", provider: "OWASP", category: "other" },
  { filename: "owasp-asvs-5.0.0.yaml", name: "OWASP ASVS 5.0.0", provider: "OWASP", category: "other" },
  { filename: "essential-eight.yaml", name: "Essential Eight", provider: "Australia ASD", category: "other" },
  { filename: "cyber_essentials.yaml", name: "Cyber Essentials", provider: "NCSC UK", category: "other" },
  { filename: "ncsc-caf-3.2.yaml", name: "NCSC CAF 3.2", provider: "NCSC UK", category: "other" },
  { filename: "swift-cscf-v2025.yaml", name: "SWIFT CSCF v2025", provider: "SWIFT", category: "other" },
  { filename: "cjis-version-5.9.5.yaml", name: "CJIS v5.9.5", provider: "FBI", category: "other" },
  { filename: "3cf-v2.yaml", name: "3CF v2", provider: "3CF", category: "other" },
  { filename: "aircyber-v1.5.2.yaml", name: "AirCyber v1.5.2", provider: "GIFAS", category: "other" },
  { filename: "dfs-500-2023-11.yaml", name: "DFS 500 (2023-11)", provider: "NY DFS", category: "other" },
];
