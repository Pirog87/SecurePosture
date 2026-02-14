# SecurePosture — Nowe Funkcjonalnosci (Roadmap)

> **Wersja:** 1.0 | **Data:** 2026-02-14 | **Status:** Koncepcja / Do dyskusji

---

## 1. Wersjonowanie dokumentow wewnetrznych (Document Version Lifecycle)

### 1.1. Problem

Codziennie pojawiaja sie drobne uwagi do dokumentow wewnetrznych (polityki, standardy, procedury). Ktos dzwoni, dyskutuje o aktualizacji punktu, proponuje nowy zapis — a te uwagi gina w mailach, plikach Word, czy po prostu w pamieci. Brakuje jednego miejsca do gromadzenia propozycji zmian, a potem mechanizmu ich zatwierdzania jako nowej wersji.

### 1.2. Rozwiazanie: Cykl zycia wersji dokumentu

Wzorowane na najlepszych praktykach GRC (ISO 9001, polityki wersjonowania w ServiceNow GRC, Archer IRM) oraz koncepcji "metapolicy" — polityki o politykach.

#### Stany wersji dokumentu

```
[Zatwierdzona]  ←  jedyna "aktywna" wersja w obiegu
    |
    +--> [Robocza]  ←  nowa wersja w przygotowaniu (draft)
           |
           +--> [W przegladzie]  ←  krazy do zaopiniowania
           |
           +--> [Zatwierdzona]  ←  staje sie nowa aktywna wersja
           |
           (stara zatwierdzona wersja -> [Archiwalna])
```

#### Kluczowe elementy

| Element | Opis |
|---------|------|
| **Wersja robocza (Draft)** | Zawsze moze istniec najwyzej jedna wersja robocza per dokument. Tworzona przez przycisk "Rozpocznij nowa wersje" z poziomu zatwierdzonego dokumentu. |
| **Propozycje zmian** | Kazdy uprawniony uzytkownik moze dodac propozycje zmiany do konkretnego punktu/wezla dokumentu. Propozycja zawiera: tekst oryginalny, proponowany nowy tekst, uzasadnienie, autor, data. |
| **Komentarze** | Komentarze per wezel — dyskusja o punkcie bez formalnej propozycji zmiany. Watki komentarzy z mozliwoscia odpowiedzi. |
| **Przeglad i akceptacja** | Wlasciciel dokumentu przeglada propozycje zmian (akceptuj/odrzuc/modyfikuj). Zaakceptowane zmiany sa aplikowane do wersji roboczej. |
| **Publikacja nowej wersji** | Po zatwierdzeniu zmian -> nowa wersja staje sie aktywna (opublikowana). Stara wersja -> archiwum. |
| **Diff / porownanie wersji** | Widok porownawczy miedzy wersjami — co sie zmienilo, kto zaproponowal, kiedy. |

#### Model danych

```
document_change_proposals
├── id
├── framework_node_id  (punkt dokumentu)
├── framework_id
├── draft_version_id   (wersja robocza)
├── proposal_type      (text_change | addition | deletion | restructure)
├── current_text       (obecna tresc)
├── proposed_text      (proponowana tresc)
├── justification      (uzasadnienie zmiany)
├── proposed_by        (kto zaproponowal)
├── proposed_at
├── status             (pending | accepted | rejected | modified)
├── reviewed_by
├── reviewed_at
├── reviewer_comment
└── applied_at

document_comments
├── id
├── framework_node_id
├── framework_id
├── parent_comment_id  (watki)
├── author
├── content
├── created_at
└── is_resolved
```

#### UX Flow

1. **Codziennie**: Uzytkownik wchodzi w dokument -> widzi przycisk "Zaproponuj zmiane" przy kazdym punkcie -> wypelnia formularz z proponowanym tekstem i uzasadnieniem.
2. **Komentarze**: Przy kazdym punkcie mozna zostawic komentarz (bez formalnej propozycji).
3. **Okresowo**: Wlasciciel dokumentu otwiera widok "Propozycje zmian" -> widzi liste oczekujacych propozycji -> akceptuje/odrzuca -> akceptowane trafiaja do wersji roboczej.
4. **Publikacja**: Gdy propozycje sa przetworzone -> przeglad wersji roboczej -> zatwierdzenie -> nowa wersja opublikowana.
5. **Historia**: Pelna historia zmian z informacja kto, co, kiedy zaproponowal i czy zostalo przyjete.

#### Wskazniki na liscie dokumentow

- Ikona/badge przy dokumencie: "3 oczekujace propozycje zmian"
- W panelu szczegalow: licznik propozycji per status

---

## 2. Szybka Ocena (Ad-Hoc Assessment / Continuous Evaluation)

### 2.1. Problem

Bezpiecznik w codziennej pracy natrafia na informacje o stanie kontroli — np. w rozmowie z adminem wychodzi, ze nie robi backupow. Chce natychmiast odnotowac te informacje w systemie, zmienic ocene zgodnosci, powiazac z ryzykiem i zdefiniowac dzialanie — bez koniecznosci tworzenia formalnego zadania audytowego.

### 2.2. Rozwiazanie: Szybka Ocena z poziomu dokumentu

Zgodnie z ISO 19011:2018 (zasada podejscia opartego na ryzyku) oraz standardami IIA 2024 (ciagle monitorowanie i audyt), system powinien umozliwiac **biezaca ocene kontroli** poza zaplanowanymi zadaniami audytowymi.

#### Nomenklatura

Ustalenia z szybkich ocen (spoza zaplanowanych audytow) to w nomenklaturze:

| Termin w systemie | Termin angielski | Zrodlo |
|---|---|---|
| **Obserwacja biezaca** | Continuous Observation | Monitorowanie ciagle (1./2. linia obrony) |
| **Ustalenie ad-hoc** | Ad-hoc Finding | Ocena poza planem audytu |

**Zrodla ustalen w systemie:**

| Kod | Etykieta PL | Opis |
|-----|-------------|------|
| `planned_audit` | Audyt planowany | Ustalenie z zaplanowanego zadania audytowego |
| `continuous_evaluation` | Ocena biezaca | Biezaca obserwacja / monitoring ciagly |
| `ad_hoc` | Ocena ad-hoc | Jednorazowa, nieplanowana ocena |
| `management_review` | Przeglad zarzadczy | Wynik przegladu kierownictwa |
| `self_assessment` | Samoocena | Samoocena jednostki/procesu |
| `incident_response` | Reakcja na incydent | Ustalenie wynikajace z obserwacji po incydencie |
| `external_audit` | Audyt zewnetrzny | Ustalenia z audytu zewnetrznego (certyfikacyjnego, regulacyjnego) |

#### UX Flow: Szybka Ocena

1. Uzytkownik przegladajac dokument widzi punkt "Wykonuj kopie zapasowe" (ref 3.4)
2. Klika przycisk **"Szybka Ocena"** przy tym punkcie
3. Otwiera sie panel/modal:

```
┌─────────────────────────────────────────────────────┐
│  SZYBKA OCENA                                       │
│  Punkt: 3.4 — Wykonuj kopie zapasowe                │
│                                                     │
│  Jednostka organizacyjna:  [IT Operations    ▼]     │
│                                                     │
│  Nowa ocena zgodnosci:     [Niezgodny        ▼]     │
│  (poprzednia: Zgodny)                               │
│                                                     │
│  Ustalenie / obserwacja:                            │
│  ┌─────────────────────────────────────────────┐    │
│  │ Admin IT potwierdził, ze kopie zapasowe     │    │
│  │ bazy klientow nie sa wykonywane od 3 mies.  │    │
│  │ Backup serwera plikow dziala poprawnie.     │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Klasyfikacja:   [Niezgodnosc drobna     ▼]         │
│  (Niezgodnosc powazna / Niezgodnosc drobna /        │
│   Obserwacja / Szansa doskonalenia)                 │
│                                                     │
│  ── Powiazane wymagania ──                          │
│  [✓] ISO 27001 A.12.3 — Kopie zapasowe             │
│  [✓] DORA Art.11 — Ciaglosc dzialania ICT           │
│  [ ] CIS 11.2 — Automated Backups                  │
│  → Zastosuj ocene rowniez do zaznaczonych           │
│                                                     │
│  ── Ryzyko ──                                       │
│  ( ) Powiaz z istniejacym ryzykiem [Wybierz... ▼]   │
│  (●) Utworz nowe ryzyko                             │
│      Nazwa: [Utrata danych klientow           ]     │
│                                                     │
│  ── Dzialanie ──                                    │
│  ( ) Powiaz z istniejacym dzialaniem                │
│  (●) Utworz nowe dzialanie                          │
│      Opis: [Wdrozyc automatyczny backup bazy  ]     │
│      Typ:  [Dzialanie naprawcze          ▼]         │
│      Termin: [2026-03-15]                           │
│      Odpowiedzialny: [Admin IT           ]          │
│                                                     │
│  [Anuluj]                     [Zapisz ocene]        │
└─────────────────────────────────────────────────────┘
```

4. Po zapisaniu:
   - Aktualizacja oceny zgodnosci punktu (per jednostka)
   - Utworzenie ustalenia/obserwacji ze zrodlem `continuous_evaluation`
   - Powiazanie z ryzykiem (nowym lub istniejacym)
   - Utworzenie dzialania (naprawczego/doskonalacego)
   - Opcjonalnie: propagacja oceny na powiazane wymagania z innych dokumentow

#### Model danych: Ustalenia

```
findings
├── id
├── title
├── description                (tresc ustalenia/obserwacji)
├── finding_type               (major_nonconformity | minor_nonconformity |
│                                observation | opportunity_for_improvement |
│                                positive_finding)
├── source                     (planned_audit | continuous_evaluation | ad_hoc |
│                                management_review | self_assessment |
│                                incident_response | external_audit)
├── status                     (open | in_progress | resolved | closed | accepted)
├── framework_node_id          (punkt dokumentu)
├── framework_id
├── org_unit_id                (jednostka organizacyjna)
├── audit_engagement_id        (NULL jesli nie z audytu planowanego)
├── previous_compliance_score
├── new_compliance_score
├── risk_id                    (powiazane ryzyko)
├── reported_by
├── reported_at
├── due_date
├── resolved_at
├── resolution_notes
└── evidence_references        (JSON - dowody)
```

#### Widok powiazanych wymagan

Kluczowa funkcjonalnosc: przy kazdym punkcie dokumentu system pokazuje **powiazane wymagania z innych dokumentow** (na bazie framework_mappings / cross-mapping). Dzieki temu bezpiecznik widzi pelny obraz — jesli backup nie dziala, to nie tylko standard wewnetrzny jest naruszony, ale tez ISO 27001 i DORA.

---

## 3. Zakres audytu z dokumentow (Audit Scope from Requirements)

### 3.1. Problem

Zadanie audytowe powinno moc korzystac z wymagan zdefiniowanych w roznych dokumentach — brac caly dokument lub tylko wybrane punkty, mieszac wymagania z roznych zrodel.

### 3.2. Rozwiazanie: Definiowanie zakresu audytu

Z poziomu zadania audytowego (audit engagement) w ramach programu, audytor definiuje zakres wybierajac wymagania:

#### UX Flow

1. Wchodzi w zadanie audytowe -> zakladka "Zakres"
2. Wybiera dokumenty zrodlowe z listy (filtry: typ, pochodzenie, status)
3. Per dokument: zaznacza "caly dokument" lub rozwija drzewo i wybiera konkretne punkty
4. Zaznaczone wymagania trafiaja do zakresu zadania
5. W trakcie audytu — lista wybranych wymagan staje sie checklistq do oceny

#### Model danych

```
audit_engagement_scope_items
├── id
├── audit_engagement_id
├── framework_id
├── framework_node_id   (NULL = caly dokument)
├── included            (boolean — domyslnie true)
├── notes               (uwagi do zakresu)
├── assigned_to         (audytor odpowiedzialny za ten punkt)
└── order_id
```

#### Integracja z cross-mappingami

Gdy audytor wybiera wymaganie z jednego dokumentu, system sugeruje powiazane wymagania z innych dokumentow (na bazie istniejacych framework_mappings). Audytor decyduje, czy je tez wlaczyc do zakresu.

---

## 4. Typy dzialan (Action Types)

### 4.1. Kontekst

Zgodnie z ISO 9001:2015 (10.2, 10.3), ISO 27001 (10.1, 10.2) oraz ISO 19011:2018, dzialania w systemie powinny miec jasna klasyfikacje odzwierciedlajaca ich nature i cel.

### 4.2. Typy dzialan w systemie

| Kod | Etykieta PL | Etykieta EN | Definicja | Powiazanie |
|-----|-------------|-------------|-----------|------------|
| `correction` | Korekcja | Correction | Natychmiastowe dzialanie eliminujace wykryta niezgodnosc (naprawia skutek, nie przyczyne). | Ryzyko / Ustalenie |
| `corrective` | Dzialanie naprawcze | Corrective Action | Dzialanie eliminujace przyczyne niezgodnosci i zapobiegajace jej ponownemu wystqpieniu. Wymaga analizy przyczyn zrodlowych. | Ryzyko / Ustalenie |
| `preventive` | Dzialanie zapobiegawcze | Preventive Action | Dzialanie eliminujace przyczyne potencjalnej niezgodnosci (zanim wystapi). W ISO 9001:2015 wchłoniete w myslenie oparte na ryzyku. | Ryzyko |
| `improvement` | Doskonalenie | Improvement Action | Dzialanie majace na celu poprawe skutecznosci procesow/kontroli. Nie wynika z niezgodnosci, lecz z ciaglego doskonalenia. | Ryzyko / Szansa |
| `opportunity_response` | Realizacja szansy | Opportunity Response | Dzialanie zwiazane z wykorzystaniem zidentyfikowanej szansy (pozytywnego ryzyka). | Szansa |

### 4.3. Atrybuty dzialania

```
actions (rozszerzenie istniejqcej tabeli)
├── ...istniejace pola...
├── action_type           (correction | corrective | preventive |
│                           improvement | opportunity_response)
├── source_type           (risk | finding | opportunity | management_review |
│                           audit | self_identified)
├── root_cause_analysis   (text — analiza przyczyn, wymagana dla corrective)
├── effectiveness_review  (boolean — czy zweryfikowano skutecznosc)
├── effectiveness_date    (data weryfikacji skutecznosci)
├── effectiveness_notes   (wynik weryfikacji)
├── risk_id               (FK — powiazane ryzyko)
├── opportunity_id        (FK — powiazana szansa)
├── finding_id            (FK — powiazane ustalenie)
└── priority              (critical | high | medium | low)
```

---

## 5. Szanse (Opportunities)

### 5.1. Kontekst

Zgodnie z ISO 31000:2018, ryzyko to "wplyw niepewnosci na cele" — obejmuje zarowno zagrozenia (efekty negatywne) jak i **szanse** (efekty pozytywne). COSO ERM 2017 rowniez integruje zarzadzanie szansami z zarzadzaniem ryzykiem.

ISO 9001:2015 (Klauzula 6.1) wymaga od organizacji identyfikacji i adresowania zarowno ryzyk jak i szans.

### 5.2. Sekcja "Szanse" w systemie

Szanse stanowia **rownolegle repozytorium obok ryzyk** — z analogiczna struktura oceny, ale odwrocona wartosciowoscia (pozytywny wplyw zamiast negatywnego).

### 5.3. Strategie reagowania na szanse

Analogicznie do strategii reagowania na zagrozenia:

| Strategia PL | Strategia EN | Odpowiednik dla zagrozen | Opis |
|---|---|---|---|
| **Wykorzystaj** | Exploit | Unikaj | Zapewnic realizacje szansy (100% prawdopodobienstwa). Przydzielic zasoby gwarantujace pozytywny wynik. |
| **Wzmocnij** | Enhance | Lagodz (Mitigate) | Zwiekszyc prawdopodobienstwo lub pozytywny wplyw szansy. |
| **Wspoldziel** | Share | Transferuj | Przydzielic szanse (czesciowo lub calkowicie) stronie trzeciej najlepiej przygotowanej do jej realizacji (partnerstwa, JV, wyspecjalizowane zespoly). |
| **Akceptuj** | Accept | Akceptuj | Uznac istnienie szansy; byc gotowym do skorzystania jesli sie zmaterializuje, ale bez aktywnej inwestycji. |

### 5.4. Atrybuty szansy

```
opportunities
├── id
├── ref_id                    (identyfikator referencyjny, np. OPP-2026-001)
├── title                     (nazwa szansy)
├── description               (szczegolowy opis)
├── category                  (strategic | operational | financial |
│                               compliance | technological | reputational)
├── source                    (market_change | technology | regulation |
│                               audit_finding | process_analysis |
│                               management_review | stakeholder_feedback)
├── related_objective         (powiazany cel strategiczny/operacyjny)
│
│  ── Ocena ──
├── likelihood                (1-5 — prawdopodobienstwo materializacji)
├── impact                    (1-5 — potencjalny pozytywny wplyw)
├── opportunity_score         (likelihood x impact)
├── time_horizon              (short_term | medium_term | long_term)
├── risk_appetite_aligned     (boolean — czy w granicach apetytu na ryzyko)
│
│  ── Reakcja ──
├── response_strategy         (exploit | enhance | share | accept)
├── resources_required        (text — potrzebne zasoby/naklady)
├── expected_benefit          (text — oczekiwane korzysci)
├── residual_risks            (text — ryzyka wynikajace z realizacji szansy)
│
│  ── Zarzadzanie ──
├── owner                     (osoba odpowiedzialna)
├── org_unit_id               (jednostka organizacyjna)
├── status                    (identified | under_assessment | being_pursued |
│                               realized | expired | declined)
├── created_at
├── created_by
├── review_date               (data nastepnej oceny)
├── realized_at               (data realizacji)
├── outcome_notes             (rzeczywiste rezultaty)
│
│  ── Powiazania ──
├── related_risk_ids          (JSON — powiazane ryzyka)
├── framework_node_ids        (JSON — powiazane wymagania)
└── action_ids                (JSON — powiazane dzialania)
```

### 5.5. UX: Sekcja Szanse

- **Menu glowne**: Nowa pozycja "Szanse" obok "Ryzyka" (lub jako zakladka w module Ryzyka)
- **Widok listy**: Analogiczny do ryzyk — tabela z filtrami, sortowaniem, panelem szczegalow
- **Mapa ciepla**: Oddzielna mapa ciepla dla szans (zielona/niebieska paleta)
- **Dashboard**: Metryki szans na dashboardzie obok metryki ryzyk
- **Dzialania**: Dzialania typu `opportunity_response` powiazane z szansami

### 5.6. Integracja Ryzyka + Szanse

Na dashboardzie i w raportach mozliwosc widoku **netto** — zagrozenia vs. szanse per obszar/cel. Pozwala to na strategiczne podejmowanie decyzji z uwzglednieniem obu stron ryzyka.

---

## 6. Podsumowanie priorytetow implementacji

| # | Funkcjonalnosc | Zlozonosc | Wartosc biznesowa | Zaleznosci |
|---|----------------|-----------|-------------------|------------|
| 1 | Szybka Ocena (Ad-Hoc Assessment) | Srednia | Bardzo wysoka | findings, framework_mappings |
| 2 | Typy dzialan | Niska | Wysoka | rozszerzenie actions |
| 3 | Zakres audytu z dokumentow | Srednia | Wysoka | audit_engagements |
| 4 | Szanse (Opportunities) | Srednia | Wysoka | nowa sekcja |
| 5 | Wersjonowanie dokumentow | Wysoka | Wysoka | change_proposals, comments |

---

## 7. Uwagi implementacyjne

### Zasada User-Friendly

- **Minimalna liczba klikniec**: Szybka Ocena powinna byc dostepna w max 2 kliknieciach z poziomu drzewa dokumentu.
- **Kontekst zawsze widoczny**: Przy ocenie punktu zawsze widoczne sa powiazane wymagania z innych dokumentow.
- **Inline editing**: Propozycje zmian dokumentu edytowane inline (nie w oddzielnym formularzu).
- **Powiadomienia**: Wlasciciel dokumentu otrzymuje powiadomienie o nowych propozycjach zmian.
- **Bulk operations**: Mozliwosc masowego zatwierdzania/odrzucania propozycji zmian.

### Zgodnosc ze standardami

- Klasyfikacja ustalen zgodna z ISO 19011 (niezgodnosc powazna/drobna, obserwacja, szansa doskonalenia, ustalenie pozytywne)
- Typy dzialan zgodne z ISO 9001:2015 i ISO 27001
- Zarzadzanie szansami zgodne z ISO 31000:2018 i COSO ERM 2017
- Zrodla ustalen zgodne ze standardami IIA 2024

### Architektura

- Findings jako centralny obiekt laczacy: dokument <-> ocena <-> ryzyko <-> dzialanie
- Cross-mapping miedzy dokumentami umozliwia propagacje ocen
- Szanse jako rownolegly obiekt do ryzyk z analogiczna struktura
