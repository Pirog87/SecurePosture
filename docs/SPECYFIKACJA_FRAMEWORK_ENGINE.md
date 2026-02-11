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

### 2.2. Tabela: `frameworks`

Metadane zaimportowanego frameworka.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK AUTO | — |
| urn | VARCHAR(500) UNIQUE | URN w formacie CISO Assistant: `urn:intuitem:risk:framework:cis-controls-v8` |
| ref_id | VARCHAR(100) | Skrócony identyfikator: `cis-v8`, `iso27001-2022`, `nist-csf-2.0` |
| name | VARCHAR(500) | Nazwa pełna: "CIS Controls v8" |
| description | TEXT | Opis frameworka |
| version | VARCHAR(50) | Wersja: "8.0", "2022", "2.0" |
| provider | VARCHAR(200) | Wydawca: "CIS", "ISO", "NIST" |
| packager | VARCHAR(200) | Kto spakował: "intuitem" (CISO Assistant), "secureposture" (własny) |
| copyright | TEXT | Informacja o licencji |
| source_format | ENUM | `ciso_assistant_excel`, `ciso_assistant_yaml`, `custom_import`, `manual` |
| source_url | VARCHAR(1000) | URL źródła (np. link do pliku na GitHub) |
| locale | VARCHAR(10) | Język główny: `en`, `pl` |
| implementation_groups_definition | JSON | Definicja IG: `{"IG1": "Basic Cyber Hygiene", "IG2": "...", "IG3": "..."}` |
| total_nodes | INT | Liczba nodes (auto po imporcie) |
| total_assessable | INT | Liczba assessable nodes (auto po imporcie) |
| imported_at | DATETIME | Data importu |
| imported_by | VARCHAR(200) | Kto zaimportował |
| is_active | BOOLEAN DEFAULT TRUE | Soft delete |
| created_at | DATETIME | — |
| updated_at | DATETIME | — |

### 2.3. Tabela: `framework_nodes`

Hierarchiczne drzewo wymagań frameworka (requirement nodes).

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK AUTO | — |
| framework_id | INT FK → frameworks | Do którego frameworka należy |
| parent_id | INT FK → framework_nodes (self-ref) | Rodzic w hierarchii (NULL = root) |
| urn | VARCHAR(500) | URN node'a: `urn:intuitem:risk:req_node:cis-controls-v8:1.1` |
| ref_id | VARCHAR(100) | ID wyświetlany: "1.1", "A.5.1", "ID.AM-1" |
| name | VARCHAR(500) | Nazwa EN |
| name_pl | VARCHAR(500) | Nazwa PL (z tłumaczenia lub ręczna) |
| description | TEXT | Opis EN |
| description_pl | TEXT | Opis PL |
| depth | INT | Głębokość w drzewie: 1=root section, 2=control, 3=sub-control |
| order_id | INT | Kolejność w grupie (sortowanie) |
| assessable | BOOLEAN | Czy ocenialny (TRUE = wymóg, FALSE = sekcja/tytuł) |
| implementation_groups | VARCHAR(100) | Grupy implementacji: "IG1,IG2,IG3" lub NULL |
| weight | INT DEFAULT 1 | Waga do scoringu (domyślnie 1) |
| importance | ENUM | `mandatory`, `recommended`, `nice_to_have`, `undefined` |
| maturity_level | INT | Opcjonalnie: poziom dojrzałości (dla frameworków maturity) |
| annotation | TEXT | Dodatkowe notatki (np. NIST CSF function: Identify/Protect/Detect) |
| threats | JSON | Powiązane zagrożenia (URN lista) |
| reference_controls | JSON | Powiązane kontrole referencyjne (URN lista) |
| typical_evidence | TEXT | Typowe dowody spełnienia |
| is_active | BOOLEAN DEFAULT TRUE | — |
| created_at | DATETIME | — |
| updated_at | DATETIME | — |

**Indeksy:** `(framework_id, parent_id)`, `(framework_id, depth)`, `(framework_id, assessable)`, `(urn)`.

### 2.4. Tabela: `framework_node_security_areas` (M2M)

Mapowanie wymagań frameworka do konfigurowalnych obszarów bezpieczeństwa.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK AUTO | — |
| framework_node_id | INT FK → framework_nodes | — |
| security_area_id | INT FK → security_areas | — |
| source | ENUM | `seed` (pre-built), `manual` (CISO), `ai_suggested` (przyszłość) |
| created_by | VARCHAR(200) | Kto przypisał |
| created_at | DATETIME | — |

**UNIQUE:** `(framework_node_id, security_area_id)`.

### 2.5. Tabela: `assessment_dimensions`

Definicja wymiarów oceny per framework. CIS ma 4 wymiary, ISO może mieć 1, SOC 2 inny zestaw.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK AUTO | — |
| framework_id | INT FK → frameworks | — |
| dimension_key | VARCHAR(50) | Klucz: `policy_defined`, `implemented`, `automated`, `reported` |
| name | VARCHAR(200) | Nazwa EN: "Policy Defined" |
| name_pl | VARCHAR(200) | Nazwa PL: "Polityka zdefiniowana" |
| description | TEXT | Opis wymiaru |
| order_id | INT | Kolejność wyświetlania |
| weight | DECIMAL(3,2) DEFAULT 1.00 | Waga wymiaru w scoringu (domyślnie równe) |
| is_active | BOOLEAN DEFAULT TRUE | — |

### 2.6. Tabela: `dimension_levels`

Poziomy oceny w ramach wymiaru. CIS: 5 poziomów (0.00-1.00). Inny framework może mieć 3 lub 7.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK AUTO | — |
| dimension_id | INT FK → assessment_dimensions | — |
| level_order | INT | Kolejność: 0, 1, 2, 3, 4 |
| value | DECIMAL(5,2) | Wartość numeryczna: 0.00, 0.25, 0.50, 0.75, 1.00 |
| label | VARCHAR(200) | Etykieta EN: "Not Implemented" |
| label_pl | VARCHAR(200) | Etykieta PL: "Niezaimplementowane" |
| description | TEXT | Opis poziomu |
| color | VARCHAR(7) | Hex color do UI: #EF4444 |

### 2.7. Tabela: `assessments`

Ocena = Framework × Org Unit × [Obszar]. Jedno badanie.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK AUTO | — |
| ref_id | VARCHAR(20) | Auto: `ASM-0001` |
| framework_id | INT FK → frameworks | Który framework |
| org_unit_id | INT FK → org_units | Która jednostka (lub NULL = cała organizacja) |
| security_area_id | INT FK → security_areas NULLABLE | Jeśli NULL = pełne badanie. Jeśli wypełnione = zawężone do obszaru |
| title | VARCHAR(500) | Tytuł: "Ocena CIS v8 — Pion DEV — Q1 2026" |
| assessor | VARCHAR(200) | Kto przeprowadza |
| assessment_date | DATE | Data badania |
| status | ENUM | `draft`, `in_progress`, `completed`, `approved`, `archived` |
| implementation_group_filter | VARCHAR(100) | Opcjonalny filtr IG: "IG1" (oceniaj tylko IG1) lub NULL (wszystkie) |
| notes | TEXT | Uwagi |
| completion_pct | DECIMAL(5,2) | Auto: % wypełnionych odpowiedzi |
| overall_score | DECIMAL(5,2) | Auto: wynik ogólny 0-100 |
| approved_by | VARCHAR(200) | Kto zatwierdził |
| approved_at | DATETIME | Kiedy zatwierdził |
| is_active | BOOLEAN DEFAULT TRUE | — |
| created_at | DATETIME | — |
| updated_at | DATETIME | — |

**Logika `security_area_id`:**
- **NULL:** Pełne badanie — oceniasz WSZYSTKIE assessable nodes frameworka
- **Wypełnione:** Zawężone — oceniasz TYLKO nodes zmapowane do tego obszaru (przez `framework_node_security_areas`)

### 2.8. Tabela: `assessment_answers`

Odpowiedź per assessable node × wymiar.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INT PK AUTO | — |
| assessment_id | INT FK → assessments | — |
| framework_node_id | INT FK → framework_nodes | Który node |
| dimension_id | INT FK → assessment_dimensions | Który wymiar (np. Policy Defined) |
| level_id | INT FK → dimension_levels NULLABLE | Wybrany poziom (NULL = jeszcze nie oceniony) |
| not_applicable | BOOLEAN DEFAULT FALSE | N/A — wykluczony ze scoringu |
| notes | TEXT | Notatki do odpowiedzi |
| evidence | TEXT | Dowody / referencje |
| created_at | DATETIME | — |
| updated_at | DATETIME | — |

**UNIQUE:** `(assessment_id, framework_node_id, dimension_id)`.

---

## 3. Obszary bezpieczeństwa — przebudowa

### 3.1. Zmiana koncepcji

**Było (v1.1):** 13 hardcoded obszarów z seed data, FK do CIS controls.

**Będzie (v2.0):** Całkowicie konfigurowalne. CISO definiuje od zera. System dostarcza domyślny zestaw 13 obszarów jako **szablon do importu** (nie wymuszony).

### 3.2. Tabela `security_areas` — rozszerzenie

Tabela istnieje, ale dodajemy pola:

| Nowe kolumny | Typ | Opis |
|-------------|-----|------|
| code | VARCHAR(50) UNIQUE | Kod maszynowy: `WORKSTATIONS`, `NETWORK_INFRA`, `CLOUD` |
| icon | VARCHAR(50) | Ikona do UI: `monitor`, `server`, `cloud` |
| color | VARCHAR(7) | Kolor hex: `#3B82F6` |
| parent_id | INT FK (self-ref) NULLABLE | Hierarchia obszarów (opcjonalna) |
| order_id | INT | Kolejność wyświetlania |

### 3.3. Domyślny szablon (importowalny, nie wymuszony)

CISO dostaje opcję "Zaimportuj domyślne obszary" przy pierwszym uruchomieniu:

1. Stacje robocze i urządzenia końcowe
2. Urządzenia mobilne
3. Ochrona danych i klasyfikacja
4. Infrastruktura sieciowa
5. Infrastruktura serwerowa
6. Microsoft 365 i usługi chmurowe
7. Chmury publiczne (AWS/Azure/GCP)
8. Kontrola dostępu i tożsamość
9. Bezpieczeństwo aplikacji
10. Zarządzanie podatnościami
11. Monitorowanie i reagowanie
12. Ciągłość działania i DR
13. Bezpieczeństwo fizyczne

Ale CISO może usunąć, zmienić, dodać — pełna kontrola.

---

## 4. Import frameworków

### 4.1. Źródła importu

| Źródło | Format | Jak działa |
|--------|--------|-----------|
| CISO Assistant Excel | .xlsx | Upload pliku → parser czyta tab `library_content` (metadane) + tab z nodes (hierarchia) |
| CISO Assistant YAML | .yaml | Upload pliku → parser czyta natywny format CISO Assistant |
| GitHub API | Auto | Endpoint `/api/v1/frameworks/import-from-github` → pobiera plik z `intuitem/ciso-assistant-community/tools/excel/` |
| Ręczny (custom) | UI/API | CISO definiuje framework ręcznie w UI (dodaj node, ustaw hierarchię) |

### 4.2. Parser Excel CISO Assistant (v2 format)

Excel file ma minimum 2 taby:

**Tab `library_content`** — metadane:
- `library_urn`, `library_version`, `library_locale`
- `library_name`, `library_description`
- `library_copyright`, `library_provider`, `library_packager`
- `framework_urn`, `framework_ref_id`, `framework_name`, `framework_description`
- Opcjonalnie: `implementation_groups_definition`, `score_definition`

**Tab z requirement nodes** (nazwa = ref_id frameworka):
- Kolumny: `assessable`, `depth`, `ref_id`, `name`, `description`, `implementation_groups`, `annotation`, `typical_evidence`
- Kolejność wierszy definiuje hierarchię (parent wynika z depth)

### 4.3. Parser YAML CISO Assistant

YAML zawiera:
```yaml
urn: urn:intuitem:risk:framework:cis-controls-v8
ref_id: cis-controls-v8
name: CIS Controls v8
requirement_nodes:
  - urn: urn:intuitem:risk:req_node:cis-controls-v8:1
    assessable: false
    depth: 1
    ref_id: "1"
    name: "Inventory and Control of Enterprise Assets"
    children:
      - urn: urn:intuitem:risk:req_node:cis-controls-v8:1.1
        assessable: true
        depth: 2
        ref_id: "1.1"
        name: "Establish and Maintain Detailed Enterprise Asset Inventory"
        implementation_groups: "IG1,IG2,IG3"
```

### 4.4. Import z GitHub (auto-pull)

Endpoint: `POST /api/v1/frameworks/import-from-github`

Body:
```json
{
  "framework_path": "cis/cis-controls-v8.xlsx",
  "auto_map_areas": true
}
```

Logika:
1. Pobierz plik z `https://raw.githubusercontent.com/intuitem/ciso-assistant-community/main/tools/excel/{path}`
2. Uruchom parser Excel
3. Zapisz framework + nodes
4. Opcjonalnie: uruchom auto-mapowanie do obszarów (pre-built seed)

### 4.5. Dostępne frameworki (przykłady z CISO Assistant)

| Framework | Plik | Assessable nodes |
|-----------|------|-----------------|
| CIS Controls v8 | `cis/cis-controls-v8.xlsx` | 148 |
| ISO 27001:2022 | `iso27001-2022.xlsx` | 93 |
| NIST CSF 2.0 | `nist-csf-2.0.xlsx` | ~108 |
| SOC 2 | `soc2-2017.xlsx` | ~64 |
| PCI DSS 4.0 | `pci-dss-4.0.xlsx` | ~250 |
| NIS2 | `nis2-directive.xlsx` | ~40 |
| DORA | `dora.xlsx` | ~50 |
| GDPR | `gdpr.xlsx` | ~88 |
| NIST 800-53 Rev 5 | `nist-800-53-rev5.xlsx` | ~1000+ |
| CMMC v2 | `cmmc-v2.xlsx` | ~110 |

---

## 5. Skale ocen per framework

### 5.1. CIS Controls v8 — migracja istniejącego modelu

CIS zachowuje 4 wymiary × 5 poziomów, ale teraz jako `assessment_dimensions` + `dimension_levels`:

**Wymiary:**
| dimension_key | name | name_pl |
|--------------|------|---------|
| policy_defined | Policy Defined | Polityka zdefiniowana |
| control_implemented | Control Implemented | Kontrola wdrożona |
| control_automated | Control Automated | Kontrola zautomatyzowana |
| control_reported | Control Reported | Kontrola raportowana |

**Poziomy (identyczne dla każdego wymiaru):**
| level_order | value | label | label_pl |
|------------|-------|-------|----------|
| 0 | 0.00 | Not done | Brak |
| 1 | 0.25 | Informal / Parts | Nieformalnie / Częściowo |
| 2 | 0.50 | Partial / Some Systems | Częściowo / Część systemów |
| 3 | 0.75 | Written / Most Systems | Zapisane / Większość systemów |
| 4 | 1.00 | Approved / All Systems | Zatwierdzone / Wszystkie systemy |

### 5.2. ISO 27001:2022 — przykład innej skali

1 wymiar: Compliance Level

| level_order | value | label | label_pl |
|------------|-------|-------|----------|
| 0 | 0.00 | Non-compliant | Niezgodny |
| 1 | 0.33 | Partially compliant | Częściowo zgodny |
| 2 | 0.66 | Largely compliant | W dużej mierze zgodny |
| 3 | 1.00 | Fully compliant | W pełni zgodny |

### 5.3. NIST CSF 2.0 — przykład skali maturity

1 wymiar: Tier Level

| level_order | value | label |
|------------|-------|-------|
| 0 | 0.00 | Partial (Tier 1) |
| 1 | 0.33 | Risk Informed (Tier 2) |
| 2 | 0.66 | Repeatable (Tier 3) |
| 3 | 1.00 | Adaptive (Tier 4) |

### 5.4. Domyślna skala (jeśli framework nie definiuje własnej)

Jeśli zaimportowany framework nie ma zdefiniowanej skali, system tworzy domyślną skalę 1 wymiar × 4 poziomy:

| value | label | label_pl |
|-------|-------|----------|
| 0.00 | Not implemented | Niezaimplementowane |
| 0.33 | Partially implemented | Częściowo |
| 0.66 | Largely implemented | W dużej mierze |
| 1.00 | Fully implemented | W pełni |

---

## 6. Mapowanie nodes → obszary bezpieczeństwa

### 6.1. Mechanizm

Tabela M2M `framework_node_security_areas` pozwala przypisać każdy node do 0-N obszarów.

- **0 obszarów:** Node widoczny w każdym zawężonym assessment'cie (nie filtrowany) ALBO niewidoczny (konfiguracja CISO: "pokaż unmapped" / "ukryj unmapped")
- **1+ obszarów:** Node widoczny tylko w assessment'ach zawężonych do tych obszarów

### 6.2. Pre-built seed: CIS v8 → 13 domyślnych obszarów

Przy imporcie CIS v8 system automatycznie mapuje sub-kontrole do obszarów (jeśli CISO używa domyślnych 13):

| CIS Control | Domyślne obszary |
|------------|-----------------|
| CSC 1: Inventory of Assets | Stacje, Serwery, Mobilne, Sieć |
| CSC 2: Software Assets | Stacje, Serwery |
| CSC 3: Data Protection | Ochrona danych |
| CSC 4: Secure Configuration | Stacje, Serwery, Sieć, Chmura |
| CSC 5: Account Management | Kontrola dostępu |
| CSC 6: Access Control | Kontrola dostępu |
| CSC 7: Vulnerability Management | Zarządzanie podatnościami |
| CSC 8: Audit Log Management | Monitorowanie |
| CSC 9: Email/Browser | Stacje, M365 |
| CSC 10: Malware Defenses | Stacje, Serwery |
| CSC 11: Data Recovery | Ciągłość działania |
| CSC 12: Network Infrastructure | Sieć |
| CSC 13: Network Monitoring | Monitorowanie, Sieć |
| CSC 14: Awareness Training | (nie mapuje się — dotyczy ludzi) |
| CSC 15: Service Provider Mgmt | Chmura |
| CSC 16: App Security | Bezp. aplikacji |
| CSC 17: Incident Response | Monitorowanie |
| CSC 18: Penetration Testing | Zarządzanie podatnościami |

Mapowanie na poziomie kontroli (depth=1) propaguje się na sub-kontrole (depth=2). CISO może nadpisać na poziomie sub-kontroli.

### 6.3. Mapowanie CISO (ręczne)

UI: W widoku frameworka, przy każdym node checkbox-y z obszarami. Bulk actions: "Przypisz zaznaczone nodes do obszaru X".

---

## 7. Assessment — przeprowadzanie oceny

### 7.1. Tworzenie nowej oceny

CISO wybiera:
1. **Framework** (np. CIS v8)
2. **Org Unit** (np. "Pion DEV") lub "Cała organizacja"
3. **Obszar bezpieczeństwa** (opcjonalny) — jeśli wybrany, tylko nodes zmapowane do tego obszaru
4. **Implementation Group** (opcjonalny) — jeśli wybrany, tylko nodes z tym IG (np. "Tylko IG1")

System tworzy assessment z pre-generowanymi answer'ami (po jednym na każdy assessable node × każdy wymiar, z level=NULL).

### 7.2. Wypełnianie oceny

UI wyświetla drzewo hierarchiczne frameworka. Dla każdego assessable node'a:
- Dropdown per wymiar (wybierz poziom)
- Checkbox "N/A" (Not Applicable)
- Pole tekstowe "Notatki"
- Pole tekstowe "Dowody"

Progress bar: X% wypełnionych (nodes z co najmniej jednym wybranym level'em / total assessable).

### 7.3. Scoring

Wynik per node: średnia arytmetyczna z wartości wybranych level'i po wszystkich wymiarach (pomijając N/A).

```
node_score = AVG(level.value for each dimension where not N/A)
```

Wynik per kontrola (parent): średnia ważona z dzieci (waga = `weight`).

Wynik ogólny: średnia ważona ze wszystkich assessable nodes.

```
overall_score = SUM(node_score × weight) / SUM(weight) × 100
```

### 7.4. Porównania

- **Między org units:** Assessment CIS dla DEV vs INFRA (side-by-side)
- **W czasie:** Assessment CIS DEV Q1 2026 vs Q3 2025 (delta)
- **Między frameworkami:** CIS score vs ISO score (normalized do 0-100)
- **Per obszar:** Jak stoi "Sieć" w CIS vs "Sieć" w ISO

---

## 8. Wpływ na Security Score

### 8.1. Filar "Control Maturity" (był: "CIS")

Filar zmienia nazwę z "CIS (10%)" na "**Control Maturity (10%)**" — bo teraz może bazować na dowolnym frameworku.

CISO konfiguruje w Security Score Settings:
- **Który framework** jest bazą filaru Control Maturity (domyślnie: CIS v8)
- **Które IG** uwzględnić (domyślnie: wszystkie)
- **Która ocena** — najnowsza approved per org unit, lub konkretna

Formuła: `Pillar_Score = overall_assessment_score` (już 0-100)

### 8.2. Możliwość wielu filarów frameworkowych (przyszłość)

System jest zaprojektowany tak, że w przyszłości CISO może dodać drugi filar frameworkowy (np. "ISO Compliance" obok "CIS Maturity"). Obecna specyfikacja: jeden filar Control Maturity, ale model danych nie blokuje rozszerzenia.

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

### 9.2. Skrypt migracji Alembic

1. Utwórz nowe tabele (frameworks, framework_nodes, assessment_dimensions, dimension_levels, assessments_v2, assessment_answers_v2)
2. Wstaw framework "CIS Controls v8" z metadanymi
3. Przepisz cis_controls → framework_nodes (depth=1)
4. Przepisz cis_sub_controls → framework_nodes (depth=2)
5. Utwórz 4 assessment_dimensions + 20 dimension_levels
6. Przepisz cis_assessments → assessments
7. Przepisz cis_answers → assessment_answers (rozdziel 4 wymiary)
8. Oznacz stare tabele jako deprecated (nie kasuj od razu)

---

## 10. API Endpoints

### 10.1. Frameworki

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/frameworks` | Lista frameworków |
| GET | `/api/v1/frameworks/{id}` | Szczegóły frameworka |
| GET | `/api/v1/frameworks/{id}/tree` | Drzewo nodes (hierarchiczne) |
| GET | `/api/v1/frameworks/{id}/nodes?assessable=true&ig=IG1` | Filtrowane nodes |
| POST | `/api/v1/frameworks/import/excel` | Import z Excel CISO Assistant |
| POST | `/api/v1/frameworks/import/yaml` | Import z YAML CISO Assistant |
| POST | `/api/v1/frameworks/import/github` | Import z GitHub API |
| DELETE | `/api/v1/frameworks/{id}` | Soft delete |

### 10.2. Mapowanie nodes → obszary

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/frameworks/{id}/area-mappings` | Mapowania dla frameworka |
| POST | `/api/v1/frameworks/{id}/area-mappings/bulk` | Bulk assign nodes → area |
| DELETE | `/api/v1/framework-nodes/{node_id}/areas/{area_id}` | Usuń mapowanie |
| POST | `/api/v1/frameworks/{id}/auto-map-areas` | Uruchom auto-mapowanie (seed) |

### 10.3. Skale ocen

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/frameworks/{id}/dimensions` | Wymiary + poziomy |
| PUT | `/api/v1/frameworks/{id}/dimensions` | Edycja skali (jeśli custom) |

### 10.4. Oceny (Assessments)

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/assessments` | Lista ocen (filtry: framework, org_unit, area) |
| GET | `/api/v1/assessments/{id}` | Szczegóły oceny + score |
| POST | `/api/v1/assessments` | Nowa ocena |
| PUT | `/api/v1/assessments/{id}/answers` | Bulk update odpowiedzi |
| PATCH | `/api/v1/assessments/{id}/answers/{answer_id}` | Update jednej odpowiedzi |
| POST | `/api/v1/assessments/{id}/approve` | Zatwierdź ocenę |
| GET | `/api/v1/assessments/{id}/score` | Wynik + breakdown |
| GET | `/api/v1/assessments/compare?ids=1,2` | Porównanie ocen |

### 10.5. Metryki dla Security Score

| Method | Endpoint | Opis |
|--------|----------|------|
| GET | `/api/v1/frameworks/metrics` | Dane do filaru Control Maturity |

---

## 11. UI — widoki

### 11.1. Biblioteka Frameworków

Lista zaimportowanych frameworków z: nazwa, wersja, provider, liczba nodes, liczba ocen, data importu. Akcje: Import (Excel/YAML/GitHub), Usuń, Przeglądaj drzewo.

### 11.2. Przeglądarka drzewa frameworka

Interaktywne drzewo hierarchiczne. Expand/collapse. Assessable nodes wyróżnione kolorem. Kolumna "Obszary" z chipami (klikalne — prowadzą do edycji mapowania).

### 11.3. Formularz Assessment

Drzewo z inline-edycją: każdy assessable node ma dropdowny per wymiar + N/A + notatki. Progress bar na górze. Filtr per obszar / IG po lewej.

### 11.4. Porównanie ocen

Side-by-side: dwa assessment'y obok siebie. Delta kolorowana (zielony = poprawa, czerwony = pogorszenie). Radar chart / heatmap.

---

## 12. Bezpieczeństwo i uprawnienia (przyszłość)

- Import frameworków: tylko Admin/CISO
- Mapowanie areas: Admin/CISO
- Tworzenie assessments: CISO + wyznaczeni assessorzy
- Wypełnianie odpowiedzi: assessor przypisany do oceny
- Zatwierdzanie: tylko CISO
- Przeglądanie wyników: wszyscy z dostępem

---

## 13. Podsumowanie zmian

| Co | Akcja |
|----|-------|
| Moduł CIS Benchmark (v1.1) | Migracja → staje się frameworkiem "CIS Controls v8" w nowym silniku |
| Tabele cis_* | Deprecated → dane przepisane do nowych tabel |
| Security Areas | Z 13 hardcoded → pełna konfigurowalność CISO |
| Security Score filar | "CIS (10%)" → "Control Maturity (10%)" z wyborem frameworka |
| Nowe tabele | frameworks, framework_nodes, framework_node_security_areas, assessment_dimensions, dimension_levels, assessments (v2), assessment_answers (v2) |
| Import | Excel + YAML + GitHub API (kompatybilność z CISO Assistant) |
| Assessment | Framework × Org Unit (pełny) lub Framework × Org Unit × Area (zawężony) |
