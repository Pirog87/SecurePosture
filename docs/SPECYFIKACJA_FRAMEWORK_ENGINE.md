# SecurePosture — Silnik Frameworków (Framework Engine)

> **Wersja:** 2.0 | **Data:** 2026-02-11 | **Status:** Specyfikacja
> **Zastępuje:** Moduł 12 (CIS Benchmark v8) — stary moduł staje się jednym z frameworków w nowym silniku

---

## 1. Cel i kontekst zmiany

### 1.1. Problem ze starym podejściem

Moduł CIS Benchmark v8 (v1.1) był dedykowanym, hardcoded modułem. Tabele `cis_controls`, `cis_sub_controls`, `cis_assessments`, `cis_answers` były zaprojektowane wyłącznie pod CIS v8 z 4 wymiarami (Policy/Implemented/Automated/Reported) × 5 poziomami.

Problem: CISO chce oceniać organizację nie tylko przez pryzmat CIS, ale też ISO 27001, NIST CSF, SOC 2, PCI DSS, NIS2, DORA i innych. Każdy framework ma inną strukturę, inną skalę ocen, inne wymagania.

### 1.2. Nowe podejście: Silnik Frameworków

Zamiast dedykowanych modułów per framework — jeden uniwersalny silnik, który:

- Importuje dowolny framework z repozytorium CISO Assistant (100+ frameworków)
- Przechowuje hierarchiczną strukturę wymagań (requirement nodes)
- Definiuje skalę ocen per framework (każdy framework ma własną)
- Przeprowadza assessment per Framework × Org Unit (pełny) lub Framework × Org Unit × Obszar (zawężony)
- Mapuje wymagania frameworków do konfigurowalnych obszarów bezpieczeństwa

### 1.3. Kompatybilność z CISO Assistant

System importuje frameworki w formacie CISO Assistant (open source, AGPL v3):
- **Excel** (.xlsx) — format v2 z tabami: library_content, framework
- **YAML** (.yaml) — natywny format CISO Assistant
- **API** — automatyczny pull z GitHub repo `intuitem/ciso-assistant-community/tools/excel/`

Repozytorium CISO Assistant: https://github.com/intuitem/ciso-assistant-community

---

## 2. Architektura danych

### 2.1. Diagram relacji

```
security_areas (konfigurowalne, CISO definiuje od zera)
    │
    │ M2M
    ▼
framework_node_security_areas ◄── framework_nodes
                                      │
                                      │ FK (parent_id = self-ref)
                                      │
                                      ▼
                                  frameworks
                                      │
                                      │ FK
                                      ▼
                              assessment_dimensions
                                      │
                                      │ FK
                                      ▼
                              dimension_levels

assessments (framework × org_unit × [security_area])
    │
    │ FK
    ▼
assessment_answers (per assessable node × dimension)
```

### 2.2-2.8. [Full table definitions as specified]

---

## 9. Migracja z v1.1

### 9.1. Dane do migracji

| Stara tabela | Nowa tabela | Mapowanie |
|-------------|-------------|-----------|
| cis_controls | framework_nodes (depth=1, assessable=false) | 18 wierszy |
| cis_sub_controls | framework_nodes (depth=2, assessable=true) | 148 wierszy |
| — | assessment_dimensions | 4 wymiary CIS (nowe) |
| — | dimension_levels | 5 × 4 = 20 wierszy (nowe) |
| cis_assessments | assessments | 1:1, dodaj framework_id |
| cis_answers | assessment_answers | Rozdziel na 4 wiersze per dimension |
