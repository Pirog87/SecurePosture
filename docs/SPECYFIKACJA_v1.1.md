# Specyfikacja Wymagań — CISO Security Posture Dashboard

**Wersja**: 1.1  
**Data**: Luty 2026  
**Status**: Dokument roboczy

## Historia Wersji

| Wersja | Data | Opis zmian |
|--------|------|------------|
| 1.0 | 09.02.2026 | Wersja początkowa — moduły 1–9, 11–12 |
| 1.1 | 09.02.2026 | Dodano moduł 10: CIS Controls v8 Benchmark (18 kontroli, 148 sub-kontroli, 4 wymiary oceny, scoring, porównania, trendy, ATT&CK, N/A per jednostkę). Rozszerzono moduł słowników o słowniki CIS. |

---

## 1. Cel

Aplikacja webowa do wizualizacji i zarządzania stanem bezpieczeństwa organizacji — na poziomie całościowym oraz w podziale na piony i jednostki biznesowe.

Przeznaczona dla CISO i kadry zarządzającej (osoby nietechniczne). Musi na pierwszy rzut oka pokazywać gdzie są największe braki, ryzyka i problemy, z możliwością wejścia w szczegóły (drill-down).

---

## 2. Zakres — Mapa Modułów

| Moduł | Opis | Rozdział |
|-------|------|----------|
| Struktura organizacyjna | Definiowanie hierarchicznej struktury jednostek organizacyjnych | 4 |
| Słowniki | Centralne zarządzanie listami słownikowymi (kategorie, poziomy, statusy) | 5 |
| Obszary bezpieczeństwa | Definiowalna lista obszarów cyberbezpieczeństwa do raportowania | 6 |
| Katalogi | Zarządzanie katalogami zagrożeń, podatności i zabezpieczeń | 7 |
| Analiza ryzyka | Rejestr ryzyk z formularzem, obliczaniem oceny i cyklem życia | 8 |
| Przeglądy ryzyka | Cykliczne przeglądy i monitorowanie przeterminowanych ryzyk | 9 |
| Ocena CIS Benchmark | Ocena dojrzałości wg CIS Controls v8 — firma i jednostki org., reocena, ATT&CK | 10 |
| Dashboardy / wizualizacja | Widoki executive, porównawcze, drill-down | 11 |
| Logowanie zmian (audit trail) | Pełne śledzenie zmian: kto, kiedy, co, z/na | 12 |

---

## 3. Wymagania Techniczne

| Obszar | Wymaganie |
|--------|-----------|
| Typ aplikacji | Aplikacja webowa |
| Hosting | Początkowo na stacji roboczej (localhost), z możliwością wdrożenia na serwerze |
| Baza danych | MariaDB |
| Backup | Funkcja eksportu/importu bazy (dump SQL) |
| Złożoność | Rozwiązanie nie może być skomplikowane w utrzymaniu — minimalna liczba zależności |

---

## 4. Moduł: Struktura Organizacyjna

### 4.1. Wymagania funkcjonalne

Hierarchiczna struktura organizacyjna z konfigurowalną liczbą poziomów (minimum 3–4). Podejście hybrydowe: poziomy są generyczne — użytkownik sam definiuje ile ich jest i jak się nazywają (np. Poziom 1 = „Organizacja", Poziom 2 = „Pion", Poziom 3 = „Dział", Poziom 4 = „Zespół"). System wymusza hierarchię między poziomami.

Interfejs do definiowania, edycji i przeglądania struktury (widok drzewa).

### 4.2. Atrybuty jednostki organizacyjnej

| Atrybut | Typ | Wymagane | Opis |
|---------|-----|----------|------|
| Nazwa | Tekst | Tak | Pełna nazwa jednostki |
| Symbol | Tekst (krótki) | Tak | Skrót / akronim (np. DEV, INFRA) |
| Właściciel | Tekst | Tak | Właściciel biznesowy jednostki |
| Security Contact | Tekst | Nie | Osoba odpowiedzialna za bezpieczeństwo (Security Champion / Officer) |
| Opis | Tekst (wielowierszowy) | Nie | Pole opisowe |
| Status | Lista | Tak | Aktywna / Nieaktywna — dezaktywacja zamiast usuwania (zachowanie historii) |
| Data utworzenia | Data | Auto | Automatycznie przy utworzeniu |
| Data dezaktywacji | Data | Auto/Ręczna | Ustawiana przy zmianie statusu na Nieaktywna |
| Jednostka nadrzędna | Wybór z drzewa | Tak* | * Wymagane dla wszystkich poza poziomem 1 (root) |

---

## 5. Moduł: Słowniki

### 5.1. Wymagania ogólne

Centralne miejsce do zarządzania wszystkimi listami słownikowymi. Każdy słownik obsługuje: dodawanie, edycję, zmianę kolejności wyświetlania (sort order) oraz archiwizację pozycji (status Aktywny / Archiwalny — archiwizacja zamiast usuwania).

### 5.2. Lista słowników

| Słownik | Kontekst użycia |
|---------|-----------------|
| Kategorie aktywów | Analiza ryzyka — pole „Kategoria aktywa" |
| Obszary raportowania | Analiza ryzyka + dashboardy. Tożsama z listą Obszarów Bezpieczeństwa (moduł 6) — jedno źródło danych. |
| Wrażliwość | Analiza ryzyka. Wartości startowe: Zwykłe, Poufne (rozszerzalna) |
| Krytyczność | Analiza ryzyka. Wartości startowe: Niska, Średnia, Wysoka (rozszerzalna) |
| Poziomy wpływu | Analiza ryzyka. 3 poziomy (1–3) z opisami — patrz tabela 5.3 |
| Poziomy prawdopodobieństwa | Analiza ryzyka. 3 poziomy (1–3) z opisami — patrz tabela 5.4 |
| Ocena zabezpieczeń | Analiza ryzyka. 4 poziomy z wartościami numerycznymi — patrz tabela 5.5 |
| Statusy ryzyka | Cykl życia ryzyka: Zidentyfikowane, W analizie, Zaakceptowane, W mitygacji, Zamknięte |
| Strategie postępowania z ryzykiem | Analiza ryzyka: Mitygacja, Akceptacja, Transfer, Unikanie |
| Kategorie zagrożeń | Katalog zagrożeń — np. Cybernetyczne, Fizyczne, Ludzkie |
| Typy zabezpieczeń | Katalog zabezpieczeń — Prewencyjne, Detekcyjne, Korekcyjne |
| Status polityki (CIS) | CIS Benchmark: No Policy, Informal Policy, Partial Written Policy, Written Policy, Approved Written Policy |
| Status wdrożenia (CIS) | CIS Benchmark: Not Implemented, Parts of Policy Implemented, Implemented on Some/Most/All Systems |
| Status automatyzacji (CIS) | CIS Benchmark: Not Automated, Parts of Policy Automated, Automated on Some/Most/All Systems |
| Status raportowania (CIS) | CIS Benchmark: Not Reported, Parts of Policy Reported, Reported on Some/Most/All Systems |
| Status oceny CIS | CIS Benchmark: Robocza, Zatwierdzona |

### 5.3. Predefiniowane wartości: Poziomy wpływu

| Poziom | Opis |
|--------|------|
| 1 — Niski | Wystąpienie zagrożenia nie powoduje utraty poufności, dostępności i integralności informacji, nie ma wpływu na realizację procesów krytycznych. W przypadku danych osobowych — brak lub niewielki negatywny wpływ na osobę. |
| 2 — Średni | Wystąpienie zagrożenia utrudnia realizację przynajmniej jednego procesu krytycznego (ale nie powoduje jego przerwania), może spowodować straty finansowe (>1 mln) lub utratę poufności, integralności informacji. W przypadku danych osobowych — negatywny wpływ na osobę. |
| 3 — Wysoki | Wystąpienie zagrożenia przerywa realizację przynajmniej jednego procesu krytycznego lub powoduje utratę poufności, integralności informacji, straty finansowe (>10 mln) bądź znaczącą utratę reputacji. W przypadku danych osobowych — znaczący negatywny wpływ. |

### 5.4. Predefiniowane wartości: Poziomy prawdopodobieństwa

| Poziom | Opis |
|--------|------|
| 1 — Niskie | Zagrożenie nie zmaterializowało się w okresie ostatniego roku. Źródło zagrożenia nie jest zmotywowane lub nie posiada zdolności do wykorzystania zagrożenia. |
| 2 — Średnie | Zagrożenie zmaterializowało się w przeciągu ostatniego roku. Źródło zagrożenia jest zmotywowane i posiada zdolności do wykorzystania zagrożenia. |
| 3 — Wysokie | Zagrożenie zmaterializowało się w przeciągu ostatniego pół roku. Źródło zagrożenia jest wysoce zmotywowane i posiada zdolności do wykorzystania zagrożenia. |

### 5.5. Predefiniowane wartości: Ocena zabezpieczeń

| Wartość (Z) | Opis |
|-------------|------|
| 0,95 | Skuteczne, kompletne, regularnie testowane zabezpieczenia |
| 0,70 | Zabezpieczenia o dobrej jakości, których skuteczność nie jest regularnie testowana |
| 0,25 | Częściowe zabezpieczenia, chroniące tylko wybrane obszary/zagrożenia lub nie w pełni skuteczne |
| 0,10 | Brak zabezpieczeń lub są one nieskuteczne |

---

## 6. Moduł: Obszary Bezpieczeństwa

Lista obszarów jest definiowalna w systemie (nie hardcodowana). Użytkownik może dodawać, edytować i archiwizować obszary. Ta sama lista stanowi słownik „Obszary raportowania" w module analizy ryzyka (jedno źródło danych).

### 6.1. Startowa lista obszarów

1. Stacje robocze
2. Urządzenia mobilne
3. Ochrona przed utratą/wyciekiem danych (DLP)
4. Urządzenia wielofunkcyjne
5. Dokumentacja papierowa
6. Budowanie świadomości bezpieczeństwa
7. Ludzie
8. Infrastruktura sieciowa
9. Infrastruktura serwerowa
10. Infrastruktura techniczna
11. Usługi M365
12. Kontrola dostępu
13. Chmury publiczne

---

## 7. Moduł: Katalogi (Zagrożenia, Podatności, Zabezpieczenia)

Trzy odrębne katalogi referencyjne zarządzane w systemie. Każdy katalog obsługuje: dodawanie nowych pozycji, edycję, archiwizację (status Aktywny / Archiwalny — bez kasowania).

### 7.1. Katalog zagrożeń

| Atrybut | Typ | Opis |
|---------|-----|------|
| ID | Numeryczne, auto | Autonumeracja |
| Nazwa | Tekst | Nazwa zagrożenia |
| Kategoria | Lista słownikowa | Słownik: Kategorie zagrożeń (np. Cybernetyczne, Fizyczne, Ludzkie) |
| Opis | Tekst (wielowierszowy) | Szczegółowy opis zagrożenia |
| Status | Lista | Aktywny / Archiwalny |

### 7.2. Katalog podatności

| Atrybut | Typ | Opis |
|---------|-----|------|
| ID | Numeryczne, auto | Autonumeracja |
| Nazwa | Tekst | Nazwa podatności |
| Powiązany obszar | Lista | Odniesienie do Obszaru bezpieczeństwa (moduł 6) |
| Opis | Tekst (wielowierszowy) | Szczegółowy opis podatności |
| Status | Lista | Aktywny / Archiwalny |

### 7.3. Katalog zabezpieczeń

| Atrybut | Typ | Opis |
|---------|-----|------|
| ID | Numeryczne, auto | Autonumeracja |
| Nazwa | Tekst | Nazwa zabezpieczenia |
| Typ | Lista słownikowa | Słownik: Typy zabezpieczeń (Prewencyjne, Detekcyjne, Korekcyjne) |
| Opis | Tekst (wielowierszowy) | Szczegółowy opis zabezpieczenia |
| Status | Lista | Aktywny / Archiwalny |

### 7.4. Powiązania między katalogami (nice-to-have, faza 2)

Zagrożenie może być powiązane z typowymi podatnościami — ułatwia wypełnianie formularza ryzyka (podpowiedzi). Do rozważenia w kolejnej iteracji.

---

## 8. Moduł: Analiza Ryzyka

### 8.1. Interfejs

Widok tabeli z rejestrem ryzyk + przycisk „Dodaj ryzyko" otwierający formularz.

| Funkcja | Opis |
|---------|------|
| Filtrowanie | Po: jednostce organizacyjnej, obszarze raportowania, statusie ryzyka, poziomie oceny ryzyka (Wysokie / Średnie / Niskie) |
| Sortowanie | Po każdej kolumnie |
| Kolorowanie wierszy | Automatyczne wg poziomu ryzyka: Wysokie = czerwony, Średnie = żółty, Niskie = zielony |
| Eksport | Do Excel (.xlsx) i CSV |

### 8.2. Formularz — pola

| Pole | Typ | Źródło | Uwagi |
|------|-----|--------|-------|
| ID | Numeryczne, auto | System | Autonumeracja |
| Jednostka organizacyjna | Wybór z drzewa struktury | Moduł 4 | Przypisanie ryzyka do pionu — klucz do raportowania per jednostka |
| Kategoria aktywa | Lista rozwijana | Słownik | |
| Nazwa aktywa | Tekst (opisowy) | Ręcznie | |
| Wrażliwość | Lista rozwijana | Słownik | Wartości startowe: Zwykłe, Poufne |
| Krytyczność | Lista rozwijana | Słownik | Wartości startowe: Niska, Średnia, Wysoka |
| Obszar raportowania | Lista rozwijana | Słownik (= moduł 6) | Powiązanie z obszarami bezpieczeństwa |
| Zagrożenie | Wybór z listy + „Dodaj nowe" | Katalog zagrożeń | |
| Podatność | Wybór z listy + „Dodaj nowe" | Katalog podatności | |
| Poziom wpływu (W) | Lista rozwijana (1–3) | Słownik | Z opisami — patrz 5.3 |
| Poziom prawdopodobieństwa (P) | Lista rozwijana (1–3) | Słownik | Z opisami — patrz 5.4 |
| Istniejące zabezpieczenia | Multi-select / tagowanie | Katalog zabezpieczeń | Wybór z listy lub „Dodaj nowe" |
| Ocena zabezpieczeń (Z) | Lista rozwijana (4 opcje) | Słownik | Wartości: 0,95 / 0,70 / 0,25 / 0,10 — patrz 5.5 |
| Ocena ryzyka (R) | Wyliczane automatycznie | Formuła | R = EXP(W) × (P / Z) — patrz 8.3 |
| Status ryzyka | Lista rozwijana | Słownik | Cykl: Zidentyfikowane → W analizie → Zaakceptowane → W mitygacji → Zamknięte |
| Właściciel ryzyka | Tekst / wybór | Ręcznie | Osoba odpowiedzialna za mitygację |
| Strategia postępowania | Lista rozwijana | Słownik | Mitygacja / Akceptacja / Transfer / Unikanie |
| Planowane działania | Tekst (wielowierszowy) | Ręcznie | Opis planowanych kroków mitygacyjnych |
| Ryzyko rezydualne | Wyliczane lub ręczne | Opcjonalne | Ocena ryzyka PO planowanych działaniach |
| Data identyfikacji | Data, auto | System | Automatycznie przy utworzeniu wpisu |
| Data przeglądu | Data | Ręcznie / auto | Kiedy ostatnio oceniano to ryzyko |

### 8.3. Formuła oceny ryzyka

```
R = EXP(W) × (P / Z)
```

- W = Poziom wpływu (1–3)
- P = Poziom prawdopodobieństwa (1–3)
- Z = Ocena zabezpieczeń (0,10 / 0,25 / 0,70 / 0,95)
- System liczy dokładnie i zaokrągla do 1 miejsca po przecinku na wyświetlaniu.

### 8.4. Klasyfikacja wyniku ryzyka

| Zakres wartości R | Ocena ryzyka | Kolor |
|-------------------|--------------|-------|
| 221 – 603 | Wysokie | 🔴 Czerwony |
| 31 – 220 | Średnie | 🟡 Żółty / pomarańczowy |
| 1,0 – 30 | Niskie | 🟢 Zielony |

### 8.5. Referencyjne macierze ryzyka

**Z = 0,10 (brak zabezpieczeń):**

| P \ W | W=1 (exp=2,7) | W=2 (exp=7,4) | W=3 (exp=20,1) |
|-------|---------------|---------------|-----------------|
| P=3 | 81,5 | 221,7 | 602,6 |
| P=2 | 54,4 | 147,8 | 401,7 |
| P=1 | 27,2 | 73,9 | 200,9 |

**Z = 0,25 (częściowe):**

| P \ W | W=1 | W=2 | W=3 |
|-------|-----|-----|-----|
| P=3 | 32,6 | 88,7 | 241,0 |
| P=2 | 21,7 | 59,1 | 160,7 |
| P=1 | 10,9 | 29,6 | 80,3 |

**Z = 0,70 (dobra jakość):**

| P \ W | W=1 | W=2 | W=3 |
|-------|-----|-----|-----|
| P=3 | 11,6 | 31,7 | 86,1 |
| P=2 | 7,8 | 21,1 | 57,4 |
| P=1 | 3,9 | 10,6 | 28,7 |

**Z = 0,95 (skuteczne, testowane):**

| P \ W | W=1 | W=2 | W=3 |
|-------|-----|-----|-----|
| P=3 | 8,6 | 23,3 | 63,4 |
| P=2 | 5,7 | 15,6 | 42,3 |
| P=1 | 2,9 | 7,8 | 21,1 |

---

## 9. Moduł: Przeglądy Ryzyka

Funkcjonalność w ramach modułu analizy ryzyka lub jako osobna zakładka. Odpowiada za zapewnienie cyklicznego przeglądu wszystkich ryzyk.

### 9.1. Wymagania funkcjonalne

| Funkcja | Opis |
|---------|------|
| Konfigurowalny cykl przeglądów | Możliwość ustawienia globalnego interwału przeglądu (np. co 3, 6, 12 miesięcy). Opcjonalnie: indywidualny interwał per ryzyko. |
| Dashboard przeterminowanych przeglądów | Lista ryzyk, których „Data przeglądu" jest starsza niż zdefiniowany cykl. Widoczna na głównym dashboardzie jako alert / KPI. |
| Rejestrowanie przeglądu | Możliwość oznaczenia ryzyka jako „Przejrzane" z automatyczną aktualizacją daty przeglądu. |

Uzasadnienie: Cykliczne przeglądy ryzyk to standard ISO 27005. Audytorzy (ISO 27001, SOC 2) rutynowo weryfikują aktualność rejestru ryzyk.

---

## 10. Moduł: Ocena CIS Benchmark (CIS Controls v8)

### 10.1. Cel modułu

Ocena dojrzałości bezpieczeństwa organizacji na podstawie 18 kontroli CIS Controls v8 (148 sub-kontroli). Ocena prowadzona w perspektywie całej firmy oraz poszczególnych jednostek organizacyjnych, z możliwością cyklicznych reocen i śledzenia trendu dojrzałości w czasie. Odzwierciedla funkcjonalność AuditScripts CIS Controls Initial Assessment Tool v8.0a rozszerzoną o wielowymiarowość organizacyjną i historię.

### 10.2. Dane referencyjne (predefiniowane)

System zawiera wbudowaną bazę CIS Controls v8 — 18 kontroli głównych i 148 sub-kontroli. Dane referencyjne są predefiniowane i nieedytowalne przez użytkownika.

**18 kontroli głównych (CSC #1–#18):**

| # | Kontrola (EN) | Kontrola (PL) | Sub-kontrole |
|---|---------------|---------------|-------------|
| 1 | Inventory and Control of Enterprise Assets | Inwentaryzacja i kontrola zasobów przedsiębiorstwa | 5 |
| 2 | Inventory and Control of Software Assets | Inwentaryzacja i kontrola zasobów oprogramowania | 7 |
| 3 | Data Protection | Ochrona danych | 13 |
| 4 | Secure Configuration of Enterprise Assets and Software | Bezpieczna konfiguracja zasobów i oprogramowania | 11 |
| 5 | Account Management | Zarządzanie kontami | 6 |
| 6 | Access Control Management | Zarządzanie kontrolą dostępu | 8 |
| 7 | Continuous Vulnerability Management | Ciągłe zarządzanie podatnościami | 7 |
| 8 | Audit Log Management | Zarządzanie logami | 11 |
| 9 | Email and Web Browser Protections | Ochrona poczty i przeglądarki | 7 |
| 10 | Malware Defenses | Ochrona przed malware | 7 |
| 11 | Data Recovery | Odzyskiwanie danych | 5 |
| 12 | Network Infrastructure Management | Zarządzanie infrastrukturą sieciową | 8 |
| 13 | Network Monitoring and Defense | Monitorowanie i obrona sieci | 10 |
| 14 | Security Awareness and Skills Training | Szkolenia świadomości bezpieczeństwa | 9 |
| 15 | Service Provider Management | Zarządzanie dostawcami usług | 7 |
| 16 | Application Software Security | Bezpieczeństwo oprogramowania | 13 |
| 17 | Incident Response Management | Zarządzanie reagowaniem na incydenty | 9 |
| 18 | Penetration Testing | Testy penetracyjne | 5 |

**Atrybuty każdej sub-kontroli:**

| Atrybut | Opis |
|---------|------|
| ID | Numer (np. 1.1, 1.2, 3.14) |
| CIS Control Detail (EN) | Oryginalny opis w języku angielskim |
| CIS Control Detail (PL) | Tłumaczenie na język polski |
| NIST CSF Function | Mapowanie: Identify / Protect / Detect / Respond / Recover |
| Implementation Groups | Przynależność do grup: IG1, IG2, IG3 (sub-kontrola może należeć do wielu) |
| Sensor or Baseline | Typ systemu / narzędzia wymaganego do implementacji |

### 10.3. Wymiary oceny (4 wymiary × 5 poziomów)

Każda sub-kontrola jest oceniana w 4 wymiarach. Każdy wymiar ma 5 poziomów (rozwijana lista) + opcję „Not Applicable". Wartości numeryczne służą do automatycznego obliczania scoringów.

**Wymiar 1: Policy Defined (Status polityki)**

| Poziom | Wartość |
|--------|---------|
| No Policy | 0,00 |
| Informal Policy | 0,25 |
| Partial Written Policy | 0,50 |
| Written Policy | 0,75 |
| Approved Written Policy | 1,00 |

**Wymiar 2: Control Implemented (Status wdrożenia)**

| Poziom | Wartość |
|--------|---------|
| Not Implemented | 0,00 |
| Parts of Policy Implemented | 0,25 |
| Implemented on Some Systems | 0,50 |
| Implemented on Most Systems | 0,75 |
| Implemented on All Systems | 1,00 |

**Wymiar 3: Control Automated (Status automatyzacji)**

| Poziom | Wartość |
|--------|---------|
| Not Automated | 0,00 |
| Parts of Policy Automated | 0,25 |
| Automated on Some Systems | 0,50 |
| Automated on Most Systems | 0,75 |
| Automated on All Systems | 1,00 |

**Wymiar 4: Control Reported to Business (Status raportowania)**

| Poziom | Wartość |
|--------|---------|
| Not Reported | 0,00 |
| Parts of Policy Reported | 0,25 |
| Reported on Some Systems | 0,50 |
| Reported on Most Systems | 0,75 |
| Reported on All Systems | 1,00 |

**Not Applicable (N/A):** Każdy wymiar każdej sub-kontroli może być oznaczony jako „Not Applicable" — sub-kontrola nie dotyczy danej jednostki lub organizacji. Sub-kontrole N/A nie są wliczane do scoringu.

### 10.4. Kontekst oceny — firma vs jednostka organizacyjna

Każda ocena CIS musi być powiązana z kontekstem:

| Pole | Opis |
|------|------|
| Jednostka organizacyjna | Wybór z drzewa struktury (moduł 4) LUB „Cała organizacja" |
| Data oceny | Timestamp — kiedy przeprowadzono ocenę |
| Oceniający | Kto wypełniał ocenę |
| Status oceny | Robocza / Zatwierdzona (słownik) |
| Uwagi | Pole tekstowe — komentarz ogólny do oceny |

Użytkownik może:
- Przeprowadzić ocenę **dla całej organizacji** (widok globalny)
- Przeprowadzić ocenę **dla wybranej jednostki organizacyjnej** (np. pion DEV, pion INFRA)
- Przeprowadzać **wielokrotne oceny w czasie** (reocena) — każda ocena jest osobnym „snapshotem" z datą; system przechowuje pełną historię

### 10.5. Interfejs oceny

**Widok listy ocen:**

| Element | Opis |
|---------|------|
| Tabela historii | Wszystkie przeprowadzone oceny z kolumnami: Data, Jednostka org., Oceniający, Maturity Rating, % Risk Addressed, Status |
| Filtrowanie | Po: jednostce organizacyjnej, zakresie dat, statusie oceny |
| Nowa ocena | Tworzy nową ocenę z wyborem kontekstu |
| Kopiowanie oceny | Utworzenie nowej oceny na bazie poprzedniej (kopia jako punkt wyjścia do reoceny) |

**Formularz oceny:**

| Element | Opis |
|---------|------|
| Wybór kontekstu | Jednostka org. lub „Cała organizacja" |
| Nawigacja po kontrolach | Zakładki lub accordion CSC #1–#18 |
| Tabela sub-kontroli | 4 kolumny dropdownów (Policy / Implemented / Automated / Reported) + kolumna N/A |
| Wyświetlanie opisu | Każda sub-kontrola pokazuje opis (PL) oraz IG, NIST CSF, Sensor jako kontekst |
| Live scoring | Wyniki obliczane na bieżąco |
| Zapis stanu | Robocza (w trakcie) / Zatwierdzona (finalna) |

### 10.6. Metryki i scoring

**Per kontrola (CSC):**

| Metryka | Obliczanie |
|---------|-----------|
| % Risk Addressed | Średnia z wartości numerycznych wszystkich 4 wymiarów wszystkich sub-kontroli (z wyłączeniem N/A) |
| % Risk Accepted | 1 − % Risk Addressed |
| All Policies Approved | Średnia wymiaru „Policy" |
| All Controls Implemented | Średnia wymiaru „Implemented" |
| All Controls Automated | Średnia wymiaru „Automated" |
| All Controls Reported | Średnia wymiaru „Reported" |
| IG1/IG2/IG3 Complete | Średnia % Risk Addressed dla sub-kontroli należących do danej IG |

**Per cała ocena (dashboard):**

| Metryka | Obliczanie |
|---------|-----------|
| Maturity Level | 5-stopniowa: L1=Policies, L2=Controls 1-5, L3=All Controls, L4=Automated, L5=Reported |
| Maturity Rating | Skala 0–5, suma ważona poziomów dojrzałości |
| Implementation Group Scores | Średnie % Risk Addressed per IG1, IG2, IG3 |
| Per CSC Score | % Risk Addressed per każda z 18 kontroli |
| ATT&CK Preventive/Detective Capability | Low / Moderate / High per kategoria ATT&CK |

### 10.7. Mapowanie MITRE ATT&CK

Kategorie ATT&CK: Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration.

Klasyfikacja zdolności:
- **High**: Średnia ocena ≥ 0,70
- **Moderate**: Średnia ocena ≥ 0,40 i < 0,70
- **Low**: Średnia ocena < 0,40

### 10.8. Not Applicable (N/A)

| Reguła | Opis |
|--------|------|
| Pomijanie w scoring | Sub-kontrole N/A nie są wliczane do żadnych średnich |
| Wizualizacja | Oznaczone szarym kolorem / przekreśleniem |
| Audit trail | Zmiana na N/A logowana z uzasadnieniem |
| Przykłady | CSC #18 (Pen Testing) — N/A dla pionu wsparcia; CSC #16 (App Security) — N/A dla pionów nie rozwijających oprogramowania |

### 10.9. Porównania i trendy

| Funkcja | Opis |
|---------|------|
| Porównanie jednostek org. | Zestawienie wyników różnych jednostek obok siebie. Widok: tabela + radar chart. |
| Trend w czasie | Wykres zmian Maturity Rating / % Risk Addressed w kolejnych ocenach. |
| Delta między ocenami | Automatyczna różnica (poprawa/pogorszenie) między ostatnią a poprzednią oceną. |
| Eksport | Excel (struktura AuditScripts — zakładki per CSC + Dashboard) i PDF. |

---

## 11. Moduł: Dashboardy / Wizualizacja

| Widok | Zawartość |
|-------|-----------|
| Executive Summary | Ogólny wynik bezpieczeństwa, KPI, heatmapa obszary × piony, TOP ryzyk, score ring, alerty przeterminowanych przeglądów |
| Piony Biznesowe | Ranking pionów, selektor z drill-down, tabela porównawcza |
| Obszary Ryzyka | Ranking barowy, radar chart, trend kwartalny |
| CIS Controls v8 | 18 kontroli z oceną vs cel, Maturity Rating, IG scores, ATT&CK capability |
| CIS Porównanie Jednostek | Zestawienie ocen CIS różnych jednostek obok siebie |
| CIS Trend | Zmiana dojrzałości CIS w czasie (reoceny) |
| Macierz Ryzyka | 5×5 (P × W) z rejestrem ryzyk |
| Przeterminowane przeglądy | Lista ryzyk wymagających przeglądu — alert KPI |

---

## 12. Moduł: Logowanie Zmian (Audit Trail)

Wymaganie przekrojowe — dotyczy wszystkich modułów systemu. Każda zmiana danych musi być rejestrowana z pełnym kontekstem.

### 12.1. Atrybuty wpisu logu

| Element | Opis |
|---------|------|
| Kto | Identyfikator użytkownika |
| Kiedy | Timestamp z dokładnością do sekundy |
| Co | Które pole zostało zmienione |
| Wartość poprzednia | Wartość przed zmianą |
| Wartość nowa | Wartość po zmianie |
| Kontekst | Identyfikator obiektu i moduł |

### 12.2. Wykorzystanie

Historia zmian służy do: analizy trendów w czasie, wykazania dojrzałości procesu (ISO 27001 / SOC 2), audytu wewnętrznego i zewnętrznego.

---

## Załącznik A: Rejestr Otwartych Punktów

| ID | Obszar | Opis | Status |
|----|--------|------|--------|
| OI-001 | Dashboardy | Doprecyzowanie wymagań wizualizacji po zamknięciu modułów danych | Otwarte |
| OI-002 | Użytkownicy i uprawnienia | Czy system single-user czy multi-user z rolami? | Do decyzji |
| OI-003 | Powiązania katalogów | Zagrożenie ↔ Podatność — faza 2 | Nice-to-have |
| OI-004 | Import danych CIS | Import istniejących ocen z pliku AuditScripts Excel (.xlsx) | Do rozważenia |
| OI-005 | Mapowanie CIS ↔ Obszary ryzyka | Cross-reference kontroli CIS z wewnętrznymi obszarami bezpieczeństwa | Nice-to-have |
