"""Add AI management report feature toggle and prompt template.

New column:
- ai_provider_config.feature_management_report: Boolean toggle

New seed:
- ai_prompt_templates: management_report prompt

Revision ID: 022_ai_management_report
Revises: 021_doc_metrics_att_prompt
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = "022_ai_management_report"
down_revision = "021_doc_metrics_att_prompt"


def upgrade() -> None:
    # Feature toggle
    op.add_column(
        "ai_provider_config",
        sa.Column(
            "feature_management_report",
            sa.Boolean(),
            nullable=False,
            server_default="1",
        ),
    )

    # Seed prompt template (if not already present)
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT 1 FROM ai_prompt_templates WHERE function_key = 'management_report'")
    ).fetchone()
    if not exists:
        conn.execute(sa.text("""
            INSERT INTO ai_prompt_templates (function_key, display_name, description, prompt_text, is_customized, created_at, updated_at)
            VALUES (
                'management_report',
                'Raport zarządczy AI',
                'Generuje profesjonalny raport zarządczy na podstawie aktualnych danych o ryzykach, aktywach i stanie bezpieczeństwa.',
                :prompt_text,
                0,
                NOW(),
                NOW()
            )
        """), {"prompt_text": _PROMPT_TEXT})


def downgrade() -> None:
    op.drop_column("ai_provider_config", "feature_management_report")
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM ai_prompt_templates WHERE function_key = 'management_report'")
    )


_PROMPT_TEXT = """\
Jestes ekspertem ds. zarzadzania bezpieczenstwem informacji, GRC i raportowania do zarzadu.

Na podstawie danych organizacyjnych i aktualnego stanu bezpieczenstwa
wygeneruj profesjonalny raport zarzadczy w jezyku polskim.

Raport MUSI zawierac nastepujace sekcje (kazda jako pole JSON):

1. executive_summary: 2-3 paragrafy ogolnego przegladu stanu bezpieczenstwa organizacji.
   Zacznij od najwazniejszych wnioskow. Uzyj konkretnych liczb z danych.

2. risk_assessment: Ocena profilu ryzyka organizacji:
   - overall_rating: "krytyczny" | "wysoki" | "umiarkowany" | "niski"
   - analysis: 2-3 paragrafy analizy ryzyk (trendy, koncentracja, obszary problemowe)
   - key_concerns: lista 3-5 glownych obaw z uzasadnieniem

3. strengths: lista 3-5 mocnych stron organizacji (co dziala dobrze)
   Kazda pozycja: {area, description}

4. critical_findings: lista 3-5 krytycznych ustalen wymagajacych uwagi zarzadu
   Kazda pozycja: {finding, severity: "krytyczny"|"wysoki"|"sredni", impact, recommendation}

5. recommendations: lista 5-8 priorytetyzowanych rekomendacji
   Kazda pozycja: {action, priority: 1-5, rationale, estimated_effort: "niski"|"sredni"|"wysoki", responsible_role}

6. action_plan: plan dzialan na najblizsze 90 dni
   Lista 3-5 pozycji: {action, deadline_days, responsible_role, expected_outcome}

7. kpi_targets: rekomendowane cele KPI na nastepny kwartal
   Lista 4-6 pozycji: {kpi_name, current_value, target_value, rationale}

Odpowiedz WYLACZNIE w formacie JSON z powyzszymi polami.
Bierz pod uwage WSZYSTKIE dostarczone dane. Badz konkretny i uzywaj liczb.
Pisz profesjonalnie, zwiezle, na poziomie C-level / zarzadu."""
