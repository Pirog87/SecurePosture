"""
SBERT-based framework mapping suggestion engine.

Inspired by CISO Assistant's tools/sbert approach: uses sentence-transformers
to compute semantic similarity between framework requirement texts and suggest
potential mappings with confidence scores.

Key design decisions:
- Model is loaded lazily on first use and cached in-process
- Embeddings are cached per framework to avoid recomputation
- Only assessable, active nodes are considered
- Relationship type is inferred from similarity score thresholds
- Returns scored suggestions for human review (draft status)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.framework import Framework, FrameworkNode

logger = logging.getLogger(__name__)

# Default model — small, fast, multilingual
DEFAULT_MODEL = "all-MiniLM-L6-v2"

# Similarity thresholds → relationship type + strength
# Based on empirical calibration similar to CISO Assistant SBERT tool
THRESHOLDS = [
    (0.85, "equal", 3),      # Very high similarity → equivalent
    (0.70, "subset", 3),     # High similarity → strong subset
    (0.55, "intersect", 2),  # Moderate similarity → intersection
    (0.40, "intersect", 1),  # Lower similarity → weak intersection
]

MIN_SCORE = 0.40  # Below this, we don't suggest a mapping


@dataclass
class SuggestedMapping:
    source_node_id: int
    source_ref_id: str | None
    source_name: str
    target_node_id: int
    target_ref_id: str | None
    target_name: str
    score: float
    relationship_type: str
    strength: int


@dataclass
class SBERTResult:
    source_framework_id: int
    source_framework_name: str
    target_framework_id: int
    target_framework_name: str
    model_name: str
    suggestions: list[SuggestedMapping] = field(default_factory=list)
    source_nodes_count: int = 0
    target_nodes_count: int = 0


@lru_cache(maxsize=2)
def _load_model(model_name: str):
    """Load and cache the sentence-transformers model."""
    from sentence_transformers import SentenceTransformer
    logger.info("Loading SBERT model: %s", model_name)
    return SentenceTransformer(model_name)


def _node_text(node: FrameworkNode) -> str:
    """Build a representative text string from a framework node."""
    parts = []
    if node.ref_id:
        parts.append(node.ref_id)
    parts.append(node.name)
    if node.description:
        parts.append(node.description)
    return " — ".join(parts)


def _classify_score(score: float) -> tuple[str, int]:
    """Map similarity score to relationship type and strength."""
    for threshold, rel, strength in THRESHOLDS:
        if score >= threshold:
            return rel, strength
    return "intersect", 1


def compute_suggestions(
    source_texts: list[str],
    target_texts: list[str],
    model_name: str = DEFAULT_MODEL,
    top_k: int = 5,
    min_score: float = MIN_SCORE,
) -> np.ndarray:
    """Compute cosine similarity matrix and return top-k indices per source.

    Returns array of shape (len(source_texts), top_k) with (index, score) pairs.
    """
    model = _load_model(model_name)

    logger.info(
        "Encoding %d source + %d target texts with %s",
        len(source_texts), len(target_texts), model_name,
    )
    src_emb = model.encode(source_texts, convert_to_numpy=True, show_progress_bar=False)
    tgt_emb = model.encode(target_texts, convert_to_numpy=True, show_progress_bar=False)

    # Normalize for cosine similarity
    src_norm = src_emb / np.linalg.norm(src_emb, axis=1, keepdims=True)
    tgt_norm = tgt_emb / np.linalg.norm(tgt_emb, axis=1, keepdims=True)

    # Cosine similarity matrix: (n_source, n_target)
    sim_matrix = src_norm @ tgt_norm.T

    # For each source, get top-k targets above min_score
    results = []
    actual_k = min(top_k, len(target_texts))
    for i in range(len(source_texts)):
        row = sim_matrix[i]
        top_indices = np.argsort(row)[::-1][:actual_k]
        pairs = [(int(j), float(row[j])) for j in top_indices if row[j] >= min_score]
        results.append(pairs)

    return results


async def suggest_mappings(
    session: AsyncSession,
    source_framework_id: int,
    target_framework_id: int,
    model_name: str = DEFAULT_MODEL,
    top_k: int = 5,
    min_score: float = MIN_SCORE,
) -> SBERTResult:
    """Generate SBERT-based mapping suggestions between two frameworks.

    Loads assessable nodes from both frameworks, computes semantic similarity,
    and returns ranked suggestions for each source requirement.
    """
    # Load frameworks
    src_fw = await session.get(Framework, source_framework_id)
    tgt_fw = await session.get(Framework, target_framework_id)
    if not src_fw:
        raise ValueError(f"Source framework {source_framework_id} not found")
    if not tgt_fw:
        raise ValueError(f"Target framework {target_framework_id} not found")

    # Load assessable, active nodes
    src_q = (
        select(FrameworkNode)
        .where(
            FrameworkNode.framework_id == source_framework_id,
            FrameworkNode.assessable == True,  # noqa: E712
            FrameworkNode.is_active == True,  # noqa: E712
        )
        .order_by(FrameworkNode.order_id)
    )
    tgt_q = (
        select(FrameworkNode)
        .where(
            FrameworkNode.framework_id == target_framework_id,
            FrameworkNode.assessable == True,  # noqa: E712
            FrameworkNode.is_active == True,  # noqa: E712
        )
        .order_by(FrameworkNode.order_id)
    )

    src_nodes = list((await session.execute(src_q)).scalars().all())
    tgt_nodes = list((await session.execute(tgt_q)).scalars().all())

    if not src_nodes or not tgt_nodes:
        return SBERTResult(
            source_framework_id=source_framework_id,
            source_framework_name=src_fw.name,
            target_framework_id=target_framework_id,
            target_framework_name=tgt_fw.name,
            model_name=model_name,
            source_nodes_count=len(src_nodes),
            target_nodes_count=len(tgt_nodes),
        )

    # Build text representations
    src_texts = [_node_text(n) for n in src_nodes]
    tgt_texts = [_node_text(n) for n in tgt_nodes]

    # Compute similarities
    top_matches = compute_suggestions(src_texts, tgt_texts, model_name, top_k, min_score)

    # Build suggestions
    suggestions = []
    for i, matches in enumerate(top_matches):
        src_node = src_nodes[i]
        for tgt_idx, score in matches:
            tgt_node = tgt_nodes[tgt_idx]
            rel, strength = _classify_score(score)
            suggestions.append(SuggestedMapping(
                source_node_id=src_node.id,
                source_ref_id=src_node.ref_id,
                source_name=src_node.name,
                target_node_id=tgt_node.id,
                target_ref_id=tgt_node.ref_id,
                target_name=tgt_node.name,
                score=round(score, 4),
                relationship_type=rel,
                strength=strength,
            ))

    # Sort by score descending
    suggestions.sort(key=lambda s: s.score, reverse=True)

    return SBERTResult(
        source_framework_id=source_framework_id,
        source_framework_name=src_fw.name,
        target_framework_id=target_framework_id,
        target_framework_name=tgt_fw.name,
        model_name=model_name,
        suggestions=suggestions,
        source_nodes_count=len(src_nodes),
        target_nodes_count=len(tgt_nodes),
    )
