# SecurePosture — Specyfikacja Rozszerzenia v2.0

## Status dokumentu

| Wersja | Data | Autor | Opis zmian |
|--------|------|-------|------------|
| 2.0 | 2026-02-11 | Claude / CISO | Pełna specyfikacja: 8 nowych modułów + Security Score (10 filarów) |

> **UWAGA:** Założenia opisane w tym dokumencie mogą się zmieniać w czasie. System musi umożliwiać modyfikację wag, progów i formuł bez ingerencji w kod. Każda zmiana konfiguracji scoringu jest wersjonowana i logowana.

---

## 1. Przegląd rozszerzenia

### 1.1. Kontekst

Wersja 1.1 SecurePosture obejmowała: słowniki, strukturę organizacyjną, obszary bezpieczeństwa, katalogi (zagrożenia, podatności, zabezpieczenia), analizę ryzyka, przeglądy ryzyka, CIS Benchmark v8 i audit trail.

Rozszerzenie v2.0 dodaje **8 nowych modułów operacyjnych**, **Silnik Frameworków** (zastępujący dedykowany moduł CIS) oraz **centralny Security Score** oparty na 10 filarach, dając CISO jeden spójny obraz stanu bezpieczeństwa organizacji.

> **WAŻNE:** Moduł CIS Benchmark v8 z v1.1 jest zastępowany przez uniwersalny Silnik Frameworków. Pełna specyfikacja: `docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md`. Obszary bezpieczeństwa stają się w pełni konfigurowalne (CISO definiuje od zera).

### 1.2. Nowe moduły

| # | Moduł | Cel |
|---|-------|-----|
| 13 | Rejestr Podatności | Ewidencja podatności (skanery + ręczne), cykl remediacji |
| 14 | Rejestr Incydentów | Obsługa incydentów bezpieczeństwa z lessons learned |
| 15 | Rejestr Wyjątków od Polityk | Formalne odstępstwa z datą wygaśnięcia i reoceną |
| 16 | Rejestr Audytów i Kontroli | Audyty → Findings → Remediacja |
| 17 | Inwentaryzacja Aktywów (CMDB) | Rejestr aktywów IT z relacjami i krytycznością |
| 18 | Rejestr Dostawców (TPRM) | Ocena ryzyka dostawców IT |
| 19 | Security Awareness | Metryki szkoleń, phishingu, zgłoszeń |
| 20 | Rejestr Polityk Bezpieczeństwa | Polityki z wersjonowaniem, potwierdzeniami, mapowaniem |
| 21 | Security Score | Centralny scoring 0–100 z 10 filarów |

### 1.3. Architektura powiązań

```
┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  AUDYTY  │  │  PODATNOŚCI  │  │   WYJĄTKI    │  │  INCYDENTY   │
│ /KONTROLE│  │              │  │  OD POLITYK  │  │              │
└────┬─────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
     │               │                 │                  │
     │ finding        │ podatność       │ wyjątek          │ incydent
     │ ujawnia        │ generuje        │ generuje          │ ujawnia
     ▼               ▼                 ▼                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                        REJESTR RYZYK                              │
│  źródło: audyt | podatność | wyjątek | incydent | operacyjne     │
└───────────────────────────────────────────────────────────────────┘
     │            │              │             │
     │ przypisane do             │ dotyczą     │
     ▼            ▼              ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  AKTYWA  │  │ DOSTAWCY │  │ POLITYKI │  │AWARENESS │
│  (CMDB)  │  │  (TPRM)  │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
     │            │              │             │
     └────────────┴──────────────┴─────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────────┐
│                      SECURITY SCORE                               │
│        10 filarów × konfigurowalna waga = wynik 0–100            │
│        + strona Metodologii + historia + trend                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Moduł 13: Rejestr Podatności

### 2.1. Cel

Centralne miejsce do rejestrowania podatności — zarówno z automatycznych skanerów (Nessus, Qualys, OpenVAS) jak i zgłoszonych ręcznie (z audytów, pen-testów, własnych obserwacji).

### 2.2. Atrybuty podatności

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| id | Auto | Tak | PK |
| ref_id | Auto | Tak | Autonumeracja: VULN-0001 |
| title | VARCHAR(255) | Tak | Krótki opis podatności |
| description | TEXT | Nie | Szczegółowy opis techniczny |
| source | FK → dictionary | Tak | Skaner automatyczny / Pen-test / Audyt wewnętrzny / Audyt zewnętrzny / Zgłoszenie ręczne |
| org_unit_id | FK → org_units | Tak | Gdzie występuje |
| asset_id | FK → assets | Nie | Powiązany asset z CMDB |
| category | FK → dictionary | Tak | Konfiguracja / Patching / Kod / Sieć / Tożsamość / Kryptografia / Inne |
| severity | FK → dictionary | Tak* | Krytyczna / Wysoka / Średnia / Niska / Informacyjna |
| cvss_score | DECIMAL(3,1) | Nie* | 0.0–10.0 (ze skanera) |
| cvss_vector | VARCHAR(255) | Nie | Pełny CVSS string |
| cve_id | VARCHAR(20) | Nie | Np. CVE-2024-12345 |
| status | FK → dictionary | Tak | Nowa / W analizie / W remediacji / Zamknięta / Zaakceptowana |
| remediation_priority | FK → dictionary | Nie | P1 (7 dni) / P2 (30 dni) / P3 (90 dni) / P4 (180 dni) |
| owner | VARCHAR(100) | Tak | Kto odpowiada za remediację |
| detected_at | DATE | Tak | Kiedy wykryto |
| closed_at | DATE | Auto | Kiedy zamknięto |
| sla_deadline | DATE | Nie | Termin remediacji (SLA) |
| remediation_notes | TEXT | Nie | Co zrobiono |
| risk_id | FK → risks | Nie | Wygenerowane ryzyko |
| finding_id | FK → audit_findings | Nie | Finding audytowy |
| exception_id | FK → policy_exceptions | Nie | Wyjątek od polityki |
| created_by | VARCHAR(100) | Tak | Kto utworzył |
| created_at | DATETIME | Auto | |
| updated_at | DATETIME | Auto | |
| is_active | BOOLEAN | Tak | Soft delete |

\* Wymagane jedno z: severity LUB cvss_score. Auto-mapowanie CVSS → severity: Krytyczna (9.0–10.0), Wysoka (7.0–8.9), Średnia (4.0–6.9), Niska (0.1–3.9), Info (0.0).

### 2.3. Cykl życia

```
Nowa → W analizie → W remediacji → Zamknięta
                 └→ Zaakceptowana (tworzy wyjątek od polityki + ryzyko)
```

### 2.4. Endpointy API

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | /api/v1/vulnerabilities | Lista z filtrami (status, severity, org_unit, asset) |
| GET | /api/v1/vulnerabilities/{id} | Szczegóły |
| POST | /api/v1/vulnerabilities | Nowa podatność |
| PUT | /api/v1/vulnerabilities/{id} | Edycja |
| PATCH | /api/v1/vulnerabilities/{id}/status | Zmiana statusu |
| GET | /api/v1/vulnerabilities/metrics | Metryki dla scoringu |
| POST | /api/v1/vulnerabilities/import | Import z CSV/skanera (bulk) |

### 2.5. Formuła filaru "Podatności"

```
Vuln_Score = max(0, min(100, base_score × sla_multiplier))

base_score = 100 − Σ (waga_severity × min(count_open, próg) / próg) × 100

Wagi severity:        Progi (konfigurowalne):
  Krytyczna = 10        Krytyczna: 3
  Wysoka = 5            Wysoka: 10
  Średnia = 2           Średnia: 30
  Niska = 0.5           Niska: 100

sla_multiplier:
  >80% w terminie: ×1.05 (bonus)
  60–80%: ×1.00
  <60%: ×0.90 (kara)
```

---

## 3. Moduł 14: Rejestr Incydentów

### 3.1. Cel

Rejestrowanie i obsługa incydentów bezpieczeństwa — od zgłoszenia przez analizę i obsługę do zamknięcia z lessons learned.

### 3.2. Atrybuty incydentu

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| id | Auto | Tak | PK |
| ref_id | Auto | Tak | Autonumeracja: INC-0001 |
| title | VARCHAR(255) | Tak | Krótki opis |
| description | TEXT | Tak | Szczegółowy opis |
| category | FK → dictionary | Tak | Phishing / Malware / Data Leak / Unauthorized Access / DDoS / Insider Threat / Social Engineering / Physical / Configuration Error / Inne |
| severity | FK → dictionary | Tak | Krytyczny / Wysoki / Średni / Niski |
| org_unit_id | FK → org_units | Tak | Gdzie wystąpił |
| asset_id | FK → assets | Nie | Dotknięty system |
| reported_by | VARCHAR(100) | Tak | Kto zgłosił |
| assigned_to | VARCHAR(100) | Tak | Kto obsługuje |
| status | FK → dictionary | Tak | Zgłoszony / W analizie / W obsłudze / Zamknięty |
| reported_at | DATETIME | Tak | Kiedy zgłoszono |
| detected_at | DATETIME | Nie | Kiedy faktycznie wystąpił |
| closed_at | DATETIME | Auto | Kiedy zamknięto |
| ttr_minutes | INT | Auto | closed_at − reported_at |
| impact | FK → dictionary | Nie | Brak wpływu / Minimalny / Ograniczony / Znaczący / Krytyczny |
| personal_data_breach | BOOLEAN | Nie | Dotyczy danych osobowych (RODO) |
| authority_notification | BOOLEAN | Nie | Wymagane zgłoszenie do UODO/CERT |
| actions_taken | TEXT | Nie | Kroki podjęte |
| root_cause | TEXT | Nie | Analiza przyczyny |
| lessons_learned | TEXT | Nie | Wnioski i rekomendacje |
| created_at | DATETIME | Auto | |
| updated_at | DATETIME | Auto | |
| is_active | BOOLEAN | Tak | Soft delete |

### 3.3. Tabele powiązań (M2M)

**incident_risks:** incident_id (FK) + risk_id (FK)
**incident_vulnerabilities:** incident_id (FK) + vulnerability_id (FK)

### 3.4. Cykl życia

```
Zgłoszony → W analizie → W obsłudze → Zamknięty (z/bez lessons learned)
```

### 3.5. Formuła filaru "Incydenty"

```
Incident_Score = max(0, min(100, 100 − incident_penalty − ttr_penalty + lessons_bonus))

incident_penalty = Σ (waga × min(count_90d, próg) / próg) × 50
  Krytyczny: waga=25, próg=2    Wysoki: waga=10, próg=5
  Średni: waga=3, próg=15       Niski: waga=1, próg=30

ttr_penalty = Σ per severity: max(0, (avg_TTR − target_TTR) / target_TTR × 10)
  Target TTR: Krytyczny=4h, Wysoki=24h, Średni=72h, Niski=168h

lessons_bonus = (% incydentów z lessons / 100) × 10 (max +10)
```

---

## 4. Moduł 15: Rejestr Wyjątków od Polityk

### 4.1. Cel

Formalne rejestrowanie odstępstw od polityk bezpieczeństwa — z oceną ryzyka, datą wygaśnięcia i wymuszonym procesem reoceny.

### 4.2. Atrybuty wyjątku

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| id | Auto | Tak | PK |
| ref_id | Auto | Tak | EXC-0001 |
| title | VARCHAR(255) | Tak | Krótki opis |
| description | TEXT | Tak | Uzasadnienie biznesowe |
| policy_id | FK → policies | Tak | Naruszana polityka |
| category | FK → dictionary | Tak | Konfiguracja / Dostęp / Sieć / Dane / Kryptografia / Fizyczne / Inne |
| org_unit_id | FK → org_units | Tak | Kogo dotyczy |
| asset_id | FK → assets | Nie | Konkretny system |
| requested_by | VARCHAR(100) | Tak | Wnioskujący (biznes) |
| approved_by | VARCHAR(100) | Tak | Zatwierdzający (CISO) |
| risk_level | FK → dictionary | Tak | Krytyczne / Wysokie / Średnie / Niskie |
| compensating_controls | TEXT | Nie | Środki kompensacyjne |
| status | FK → dictionary | Tak | Wnioskowany / Zatwierdzony / Aktywny / Wygasły / Odnowiony / Zamknięty / Odrzucony |
| start_date | DATE | Tak | Od kiedy |
| expiry_date | DATE | Tak | Do kiedy (WYMAGANE) |
| review_date | DATE | Auto | = expiry_date − 30 dni |
| closed_at | DATE | Auto | |
| risk_id | FK → risks | Nie | Powiązane ryzyko |
| vulnerability_id | FK → vulnerabilities | Nie | Powiązana podatność |
| created_at / updated_at / is_active | | | Standard |

### 4.3. Automatyczne reguły

- 30 dni przed wygaśnięciem: alert "Do reoceny"
- Po expiry_date: status auto → "Wygasły"
- Wygasły bez decyzji: czerwony alert na dashboardzie

### 4.4. Formuła filaru "Wyjątki"

```
Exception_Score = max(0, min(100, 100 − active_penalty − expired_penalty + compensating_bonus))

active_penalty = Σ (waga_risk × count_active)
  Krytyczne=15, Wysokie=8, Średnie=3, Niskie=1

expired_penalty = count_expired_without_decision × 10
compensating_bonus = (% ze środkami kompensacyjnymi / 100) × 5 (max +5)
```

---

## 5. Moduł 16: Rejestr Audytów i Kontroli

### 5.1. Struktura: Audyt → Findings

**Audyt:** ref_id (AUD-0001), title, audit_type (Wewnętrzny/Zewnętrzny/Regulacyjny/Certyfikacyjny/Pen-test), framework, auditor, org_unit_id, status, start_date, end_date, summary, overall_rating, findings_count (auto).

**Finding:** ref_id (FND-0001), audit_id (FK), title, description, finding_type (Niezgodność główna/drobna/Obserwacja/Rekomendacja/Mocna strona), severity, security_area_id, framework_node_id (FK → framework_nodes, opcjonalnie), remediation_owner, status (Nowy/W remediacji/Do weryfikacji/Zamknięty/Zaakceptowany), sla_deadline, remediation_plan, remediation_evidence, risk_id, vulnerability_id.

### 5.2. Formuła filaru "Audyty"

```
Audit_Score = max(0, min(100, base_score × sla_multiplier))

base_score = 100 − Σ (waga × count_open_findings)
  Krytyczny=20, Wysoki=10, Średni=4, Niski=1

sla_multiplier: >90%=×1.05, 70–90%=×1.00, 50–70%=×0.90, <50%=×0.80
```

---

## 6. Moduł 17: Inwentaryzacja Aktywów (CMDB)

### 6.1. Cel

Pełny rejestr aktywów IT z relacjami hierarchicznymi (serwer → aplikacja → dane).

### 6.2. Atrybuty aktywa

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| id / ref_id (AST-0001) | Auto | Tak | |
| name | VARCHAR(255) | Tak | Nazwa |
| description | TEXT | Nie | |
| asset_type | FK → dictionary | Tak | Serwer / Aplikacja / Baza danych / Stacja robocza / Urządzenie sieciowe / Urządzenie mobilne / Usługa chmurowa / Dane / Inne |
| asset_subtype | VARCHAR(100) | Nie | Np. "VM Linux", "SaaS" |
| org_unit_id | FK → org_units | Tak | Właściciel organizacyjny |
| owner | VARCHAR(100) | Tak | Właściciel biznesowy |
| technical_owner | VARCHAR(100) | Nie | Opiekun techniczny |
| criticality | FK → dictionary | Tak | Krytyczny / Wysoki / Średni / Niski |
| data_sensitivity | FK → dictionary | Nie | Publiczne / Wewnętrzne / Poufne / Ściśle tajne |
| environment | FK → dictionary | Nie | Produkcja / Staging / Dev / Test |
| location | VARCHAR(255) | Nie | Lokalizacja / region chmury |
| ip_address | VARCHAR(45) | Nie | IPv4/v6 |
| hostname | VARCHAR(255) | Nie | |
| os_version | VARCHAR(100) | Nie | |
| vendor | VARCHAR(100) | Nie | Producent |
| support_end_date | DATE | Nie | EOL/EOS |
| parent_asset_id | FK → assets | Nie | Relacja hierarchiczna (self-ref) |
| status | FK → dictionary | Tak | Aktywny / W budowie / Wycofywany / Wycofany |
| last_scan_date | DATE | Nie | Ostatni skan |
| notes | TEXT | Nie | |

### 6.3. Relacje hierarchiczne

```
Serwer fizyczny → VM/Kontener → Aplikacja → Baza danych → Dane
```

Realizowane przez parent_asset_id (self-referencing FK).

### 6.4. Formuła filaru "Aktywa"

```
Asset_Score = coverage_score×0.4 + eol_score×0.25 + scan_score×0.2 + hygiene_score×0.15

coverage_score = (% aktywów z owner + criticality) × 100
eol_score = 100 − (count_eol / total_active × 100)
scan_score = (% skanowanych w 30d) × 100
hygiene_score = 100 − (orphan + critical_without_risk) / total × 100
```

---

## 7. Moduł 18: Rejestr Dostawców (TPRM)

### 7.1. Cel

Rejestr dostawców IT, ocena ryzyka (kwestionariusze, rating), śledzenie SLA.

### 7.2. Atrybuty dostawcy

ref_id (VND-0001), name, category (Cloud/SaaS/Outsourcing/Consulting/Hardware/Telco/Inne), criticality, services_provided, data_access_level (Brak/Wewnętrzne/Poufne/Osobowe), contract_owner, security_contact, contract_start/end, sla_description, status (Aktywny/W ocenie/Zawieszony/Zakończony), last_assessment_date, next_assessment_date, risk_rating (A/B/C/D), risk_score (0–100), questionnaire_completed, certifications, risk_id (FK → risks).

### 7.3. Ocena dostawcy

**vendor_assessments:** vendor_id, assessment_date, assessed_by, total_score, risk_rating.
**vendor_assessment_answers:** assessment_id, question_code, question_text, answer (0–5), notes.

### 7.4. Formuła filaru "Dostawcy (TPRM)"

```
TPRM_Score = coverage_score×0.4 + rating_score×0.4 + timeliness_score×0.2

coverage_score = (% dostawców z oceną w 12 mies.) × 100
rating_score = średni risk_score (ważony krytycznością: Krytyczny=4, Wysoki=3, Średni=2, Niski=1)
timeliness_score = 100 − (% z przeterminowaną oceną) × 100
```

---

## 8. Moduł 19: Security Awareness

### 8.1. Cel

Śledzenie metryk świadomości: szkolenia, phishing simulations, zgłoszenia pracowników.

### 8.2. Struktura

**awareness_campaigns:** ref_id (AWR-0001), title, campaign_type (Szkolenie online/stacjonarne/Phishing simulation/Test wiedzy), org_unit_id, target_audience_count, start/end_date, status.

**awareness_results:** campaign_id, org_unit_id, participants_count, completed_count, failed_count, reported_count, avg_score, completion_rate (auto), click_rate (auto), report_rate (auto), recorded_at.

**awareness_employee_reports** (miesięczne): month, org_unit_id, reports_count, confirmed_count.

### 8.3. Formuła filaru "Awareness"

```
Awareness_Score = training_score×0.40 + phishing_score×0.40 + reporting_score×0.20

training_score = avg_training_completion (0–100)
phishing_score = max(0, 100 − avg_click_rate × 2)
reporting_score = min(100, avg_report_rate × 3)
```

---

## 9. Moduł 20: Rejestr Polityk Bezpieczeństwa

### 9.1. Cel

Rejestr polityk z wersjonowaniem, śledzeniem potwierdzeń, mapowaniem do standardów.

### 9.2. Atrybuty polityki

ref_id (POL-0001), title, category (Bezpieczeństwo IT/Ochrona danych/Dostęp/Sieć/Fizyczne/Ciągłość/HR/Inne), owner, approver, status (Robocza/W recenzji/Zatwierdzona/Wycofana), current_version, effective_date, review_date, last_reviewed_at, document_url, target_audience_count, acknowledgment_count (auto), acknowledgment_rate (auto).

### 9.3. Mapowanie do standardów

**policy_standard_mappings:** policy_id, framework_node_id (FK → framework_nodes, opcjonalnie — jeśli framework zaimportowany), standard_name (ISO 27001/CIS v8/NIST CSF/SOC 2/RODO/PCI DSS), control_ref (np. "A.9.2.1"), control_description.

> **Uwaga:** Jeśli dany standard jest zaimportowany jako framework w Silniku Frameworków, mapowanie może wskazywać bezpośrednio na `framework_node_id`. Jeśli nie — standard_name + control_ref jako tekst.

### 9.4. Potwierdzenia

**policy_acknowledgments:** policy_id, org_unit_id, acknowledged_by, acknowledged_at, policy_version.

### 9.5. Formuła filaru "Polityki"

```
Policy_Score = ack_score×0.35 + review_score×0.30 + coverage_score×0.20 + approval_score×0.15

ack_score = avg_acknowledgment_rate (0–100)
review_score = 100 − (overdue_review / total_active × 100)
coverage_score = (% z mapowaniem do standardu) × 100
approval_score = (% w statusie Zatwierdzona) × 100
```

---

## 10. Moduł 21: Security Score

### 10.1. 10 filarów — domyślne wagi

| # | Filar | Waga | Moduł źródłowy |
|---|-------|------|----------------|
| 1 | Ryzyka | 20% | Analiza ryzyka (moduł 8) |
| 2 | Podatności | 15% | Rejestr podatności (moduł 13) |
| 3 | Incydenty | 12% | Rejestr incydentów (moduł 14) |
| 4 | Wyjątki od polityk | 10% | Rejestr wyjątków (moduł 15) |
| 5 | Control Maturity | 10% | Silnik Frameworków (domyślnie CIS v8, konfigurowalny) |
| 6 | Audyty / Findings | 10% | Rejestr audytów (moduł 16) |
| 7 | Aktywa (CMDB) | 8% | Inwentaryzacja aktywów (moduł 17) |
| 8 | Dostawcy (TPRM) | 6% | Rejestr dostawców (moduł 18) |
| 9 | Polityki | 5% | Rejestr polityk (moduł 20) |
| 10 | Awareness | 4% | Security Awareness (moduł 19) |

CISO może zmieniać wagi — system wymusza sumę 100%.

### 10.2. Formuła filaru "Ryzyka"

```
Risk_Score = max(0, min(100, 100 − (total_risk_impact / max_possible × 100)))

total_risk_impact = Σ (normalized_R × status_weight)
normalized_R = R / 602.6

status_weight:
  Zidentyfikowane=1.0, W analizie=0.9, W mitygacji=0.5, Zaakceptowane=0.3, Zamknięte=0.0
```

### 10.3. Formuła filaru "Control Maturity"

```
Control_Maturity_Score = overall_assessment_score (0–100)

Źródło: najnowszy approved assessment z wybranego frameworka (domyślnie CIS v8).
CISO konfiguruje: który framework, które IG, która ocena.
Jeśli brak approved assessment → filar = 0.

Dla CIS v8 (kompatybilność wsteczna):
  node_score = AVG(level.value per dimension where not N/A)
  overall = SUM(node_score × weight) / SUM(weight) × 100

Szczegóły skali i wymiarów: docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md
```

### 10.4. Końcowa formuła

```
Security_Score = Σ (waga_i × clamp(filar_score_i, 0, 100))
```

### 10.5. Klasyfikacja

| Zakres | Ocena | Kolor |
|--------|-------|-------|
| 80–100 | Dobry | 🟢 Zielony |
| 60–79 | Zadowalający | 🟡 Żółty |
| 40–59 | Wymaga poprawy | 🟠 Pomarańczowy |
| 0–39 | Krytyczny | 🔴 Czerwony |

### 10.6. Snapshoty historyczne

**security_score_snapshots:** snapshot_date, total_score, pillar_1..10_score, pillar_1..10_weight, config_version, triggered_by ("scheduled"/"manual"/"framework_assessment"/"config_change"), created_by.

Automatycznie: codziennie (cron). Dodatkowo: po zatwierdzeniu assessment'u frameworka, po zmianie konfiguracji, na żądanie.

### 10.7. Dashboard — elementy wizualne

| Element | Opis |
|---------|------|
| Prędkościomierz | Gauge 0–100 z kolorami |
| Delta | Zmiana vs tydzień/miesiąc/kwartał (↑+5 lub ↓-3) |
| Trend | Wykres liniowy w czasie |
| Breakdown | 10 filarów — radar chart lub horizontal bars |
| Worst pillars | Top 3 najsłabsze z rekomendacją |
| Alerts | Wygasające wyjątki, przeterminowane findings, krytyczne podatności |

### 10.8. Endpointy API

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | /api/v1/security-score | Aktualny score + breakdown |
| GET | /api/v1/security-score/history | Historia snapshotów |
| POST | /api/v1/security-score/snapshot | Wymuś snapshot |
| GET | /api/v1/security-score/methodology | Metodologia (auto-generowana) |
| GET | /api/v1/security-score/methodology/pdf | Eksport PDF |
| GET | /api/v1/security-score/config | Aktualna konfiguracja |
| PUT | /api/v1/security-score/config | Zmień konfigurację |
| GET | /api/v1/security-score/config/history | Historia zmian |

---

## 11. Konfiguracja Security Score

### 11.1. Panel "Ustawienia Security Score"

Dostępny dla CISO / Admin. Zawiera:

**Wagi filarów:** 10 pól, walidacja sumy = 100%. Możliwość wyłączenia filaru (waga = 0%).

**Progi podatności:**
vuln_threshold_critical=3, high=10, medium=30, low=100

**Target TTR incydentów:**
critical=4h, high=24h, medium=72h, low=168h

**Okno czasowe incydentów:** incident_window_days=90

**SLA findings:** critical=14d, high=30d, medium=60d, low=90d

**Częstotliwość snapshotu:** daily / weekly / monthly

### 11.2. Wersjonowanie konfiguracji

**score_config_versions:** version (auto: "v1", "v2"...), config_json (JSON), effective_from, changed_by, change_reason (wymagane), created_at.

Każda zmiana logowana do audit_log z module="security_score_config".

---

## 12. Strona "Metodologia Scoringu"

### 12.1. Cel

Auto-generowana strona wyjaśniająca scoring. Zawsze aktualna — dynamicznie z konfiguracji. Dostępna dla każdego użytkownika.

### 12.2. Zawartość

**Nagłówek:** Tytuł, wersja konfiguracji, data.

**Sekcja 1 — Przegląd:** Czym jest Security Score, skala 0–100, klasyfikacja kolorami, diagram filarów.

**Sekcja 2 — Filary (×10):** Dla każdego: nazwa, waga, co mierzy, skąd dane, formuła (czytelna), progi/parametry, **przykład obliczenia z aktualnymi danymi:**
> "Dziś filar Podatności = 72, ponieważ masz 2 otwarte krytyczne (próg: 3), 7 wysokich (próg: 10), 12 średnich (próg: 30). SLA compliance: 78% → mnożnik ×1.00."

**Sekcja 3 — Końcowa formuła:** Wzór + aktualny rozkład per filar.

**Sekcja 4 — Historia zmian:** Tabela: wersja, data, kto, co, dlaczego.

### 12.3. Eksport

Przycisk "Eksport do PDF" — do załączenia do raportów dla zarządu/audytorów.

---

## 13. Nowe słowniki

| Kod | Wartości |
|-----|---------|
| vuln_source | Skaner automatyczny / Pen-test / Audyt wewnętrzny / Audyt zewnętrzny / Zgłoszenie ręczne |
| vuln_category | Konfiguracja / Patching / Kod / Sieć / Tożsamość / Kryptografia / Inne |
| severity_universal | Krytyczny / Wysoki / Średni / Niski / Informacyjny |
| remediation_priority | P1 (7 dni) / P2 (30 dni) / P3 (90 dni) / P4 (180 dni) |
| vuln_status | Nowa / W analizie / W remediacji / Zamknięta / Zaakceptowana |
| incident_category | Phishing / Malware / Data Leak / Unauthorized Access / DDoS / Insider Threat / Social Engineering / Physical / Configuration Error / Inne |
| incident_status | Zgłoszony / W analizie / W obsłudze / Zamknięty |
| incident_impact | Brak wpływu / Minimalny / Ograniczony / Znaczący / Krytyczny |
| exception_category | Konfiguracja / Dostęp / Sieć / Dane / Kryptografia / Fizyczne / Inne |
| exception_status | Wnioskowany / Zatwierdzony / Aktywny / Wygasły / Odnowiony / Zamknięty / Odrzucony |
| audit_type | Wewnętrzny / Zewnętrzny / Regulacyjny / Certyfikacyjny / Pen-test |
| audit_rating | Pozytywna / Warunkowo pozytywna / Negatywna / N/A |
| finding_type | Niezgodność główna / Niezgodność drobna / Obserwacja / Rekomendacja / Mocna strona |
| finding_status | Nowy / W remediacji / Do weryfikacji / Zamknięty / Zaakceptowany |
| asset_type | Serwer / Aplikacja / Baza danych / Stacja robocza / Urządzenie sieciowe / Urządzenie mobilne / Usługa chmurowa / Dane / Inne |
| asset_status | Aktywny / W budowie / Wycofywany / Wycofany |
| asset_environment | Produkcja / Staging / Development / Test |
| data_sensitivity | Publiczne / Wewnętrzne / Poufne / Ściśle tajne |
| vendor_category | Cloud Provider / SaaS / Outsourcing IT / Consulting / Hardware / Telco / Inne |
| vendor_status | Aktywny / W ocenie / Zawieszony / Zakończony |
| vendor_data_access | Brak dostępu / Dane wewnętrzne / Dane poufne / Dane osobowe |
| vendor_risk_rating | A (niskie ryzyko) / B / C / D (wysokie ryzyko) |
| campaign_type | Szkolenie online / Szkolenie stacjonarne / Phishing simulation / Test wiedzy |
| campaign_status | Planowana / W trakcie / Zakończona |
| policy_category | Bezpieczeństwo IT / Ochrona danych / Dostęp / Sieć / Fizyczne / Ciągłość działania / HR / Inne |
| policy_status | Robocza / W recenzji / Zatwierdzona / Wycofana |

---

## 14. Zmiany w istniejących modułach

### 14.1. Tabela risks — nowe pola

| Pole | Typ | Opis |
|------|-----|------|
| asset_id | FK → assets | Powiązany asset (opcjonalne) |
| vendor_id | FK → vendors | Powiązany dostawca (opcjonalne) |
| source_type | VARCHAR(50) | "manual" / "vulnerability" / "incident" / "audit_finding" / "exception" |
| source_id | INT | ID obiektu źródłowego |

---

## 15. Powiązania — tabela FK

| Źródło | FK | Cel | Typ |
|--------|----|-----|-----|
| vulnerabilities | risk_id | risks | N:1 opt |
| vulnerabilities | finding_id | audit_findings | N:1 opt |
| vulnerabilities | exception_id | policy_exceptions | N:1 opt |
| vulnerabilities | asset_id | assets | N:1 opt |
| vulnerabilities | org_unit_id | org_units | N:1 req |
| incidents | asset_id | assets | N:1 opt |
| incidents | org_unit_id | org_units | N:1 req |
| incident_risks | incident_id + risk_id | | M2M |
| incident_vulnerabilities | incident_id + vulnerability_id | | M2M |
| policy_exceptions | policy_id | policies | N:1 req |
| policy_exceptions | risk_id | risks | N:1 opt |
| policy_exceptions | vulnerability_id | vulnerabilities | N:1 opt |
| policy_exceptions | asset_id | assets | N:1 opt |
| policy_exceptions | org_unit_id | org_units | N:1 req |
| audits | org_unit_id | org_units | N:1 opt |
| audit_findings | audit_id | audits | N:1 req |
| audit_findings | risk_id | risks | N:1 opt |
| audit_findings | vulnerability_id | vulnerabilities | N:1 opt |
| assets | parent_asset_id | assets | N:1 self-ref opt |
| assets | org_unit_id | org_units | N:1 req |
| vendors | risk_id | risks | N:1 opt |
| vendor_assessments | vendor_id | vendors | N:1 req |
| awareness_campaigns | org_unit_id | org_units | N:1 opt |
| awareness_results | campaign_id | awareness_campaigns | N:1 req |
| policy_standard_mappings | policy_id | policies | N:1 req |
| policy_acknowledgments | policy_id | policies | N:1 req |
| risks | asset_id | assets | N:1 opt (NOWE) |
| risks | vendor_id | vendors | N:1 opt (NOWE) |
| framework_nodes | framework_id | frameworks | N:1 req |
| framework_nodes | parent_id | framework_nodes | N:1 self-ref opt |
| framework_node_security_areas | framework_node_id | framework_nodes | N:1 req (M2M) |
| framework_node_security_areas | security_area_id | security_areas | N:1 req (M2M) |
| assessment_dimensions | framework_id | frameworks | N:1 req |
| dimension_levels | dimension_id | assessment_dimensions | N:1 req |
| assessments | framework_id | frameworks | N:1 req |
| assessments | org_unit_id | org_units | N:1 opt |
| assessments | security_area_id | security_areas | N:1 opt |
| assessment_answers | assessment_id | assessments | N:1 req |
| assessment_answers | framework_node_id | framework_nodes | N:1 req |
| assessment_answers | dimension_id | assessment_dimensions | N:1 req |
| assessment_answers | level_id | dimension_levels | N:1 opt |
| audit_findings | framework_node_id | framework_nodes | N:1 opt (NOWE) |
| policy_standard_mappings | framework_node_id | framework_nodes | N:1 opt (NOWE) |

---

## 16. Kolejność implementacji

### Faza 0: Silnik Frameworków (PRIORYTET)
0. Silnik Frameworków — nowe tabele, migracja CIS z v1.1, import Excel/YAML/GitHub (`docs/SPECYFIKACJA_FRAMEWORK_ENGINE.md`)
0. Przebudowa Obszarów Bezpieczeństwa — z hardcoded na konfigurowalne

### Faza 1: Fundamenty
1. Inwentaryzacja Aktywów (CMDB) — moduł 17
2. Rejestr Podatności — moduł 13
3. Rejestr Incydentów — moduł 14

### Faza 2: Governance
4. Rejestr Wyjątków od Polityk — moduł 15
5. Rejestr Audytów i Kontroli — moduł 16
6. Rejestr Polityk Bezpieczeństwa — moduł 20

### Faza 3: Kontekst zewnętrzny
7. Rejestr Dostawców (TPRM) — moduł 18
8. Security Awareness — moduł 19

### Faza 4: Scoring
9. Security Score — moduł 21
10. Strona Metodologii
11. Dashboard v2 (prędkościomierz + trend + breakdown)

### Faza 5: Baza danych
12. Nowe tabele + seed data + migracja Alembic

---

## 17. Podsumowanie

| Metryka | Wartość |
|---------|---------|
| Nowe moduły | 8 (+1 scoring +1 Framework Engine) |
| Nowe tabele | ~27 (w tym 7 dla Framework Engine) |
| Nowe słowniki | 25 |
| Filary Security Score | 10 (filar 5: Control Maturity zamiast CIS-only) |
| Importowalne frameworki | 100+ (CISO Assistant) |
| Nowe endpointy API | ~80 |
| Nowe widoki frontend | 12+ |

System po rozszerzeniu daje CISO:
- **Jeden score** — natychmiastowa odpowiedź "jak u nas jest?"
- **Multi-framework** — ocena wg CIS, ISO, NIST, SOC2 i 100+ innych frameworków
- **Transparentność** — Metodologia wyjaśnia każdy aspekt scoringu
- **Konfigurowalność** — wagi, progi, parametry, obszary bezpieczeństwa zmieniane bez kodu
- **Wersjonowanie** — każda zmiana konfiguracji logowana z uzasadnieniem
- **Powiązania** — finding/podatność/wyjątek/incydent → ryzyko → score
- **Trend** — snapshoty pokazują czy idzie ku lepszemu
