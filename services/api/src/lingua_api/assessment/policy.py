"""Pure deterministic policy engine for starting-level-heuristic-v1.

No database, no HTTP, no IRT, no ML, no randomness.
All constants and formulas are frozen by ADR-020 and
docs/STARTING_LEVEL_ESTIMATE_V1.md §9, §10.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Literal, cast

# ---------------------------------------------------------------------------
# Frozen policy identity
# ---------------------------------------------------------------------------

POLICY_VERSION: str = "starting-level-heuristic-v1"

# Band codes (A0 is LINGUA's project-defined pre-A1 starting band).
BandCode = Literal["A0", "A1", "A2", "B1"]

# Private score anchors — band selected by gate logic, not these anchors.
BAND_ANCHORS: dict[BandCode, float] = {
    "A0": 0.1000,
    "A1": 0.3000,
    "A2": 0.5250,
    "B1": 0.7250,
}

# Terminal assessment lengths (slots presented, inclusive).
ASSESSMENT_LENGTHS: dict[str, int] = {
    "A0_A1_boundary": 8,
    "A1_A2_boundary": 12,
    "A2_B1_boundary": 16,
}
MINIMUM_ITEM_COUNT: int = 8
MAXIMUM_ITEM_COUNT: int = 16

# Gate thresholds (frozen).
PRIMARY_PASS_THRESHOLD: int = 3  # correct out of 4
VERIFIED_PASS_THRESHOLD: int = 6  # correct out of 8 (decisive window)
MIN_DECISIVE_EVIDENCE: int = 6  # non-skipped scorable in decisive window
MIN_CONFIDENCE_THRESHOLD: float = 0.40
CONFIDENCE_CAP: float = 0.85

# Confidence band thresholds (inclusive lower, exclusive upper).
CONFIDENCE_BAND_THRESHOLDS: list[tuple[float, str]] = [
    (0.80, "high"),
    (0.60, "medium"),
    (0.00, "low"),
]


# ---------------------------------------------------------------------------
# Domain/slot definitions
# ---------------------------------------------------------------------------


class Domain(StrEnum):
    VOCABULARY_RECOGNITION = "vocabulary_recognition"
    GRAMMAR_IN_CONTEXT = "grammar_in_context"
    READING_COMPREHENSION = "reading_comprehension"
    LISTENING_COMPREHENSION = "listening_comprehension"


class BundleKind(StrEnum):
    PRIMARY = "primary"
    VERIFICATION = "verification"


# Stable slot order within every four-slot bundle.
BUNDLE_SLOT_DOMAINS: list[Domain] = [
    Domain.VOCABULARY_RECOGNITION,
    Domain.GRAMMAR_IN_CONTEXT,
    Domain.READING_COMPREHENSION,
    Domain.LISTENING_COMPREHENSION,
]


@dataclass(frozen=True)
class PolicySlot:
    """Frozen descriptor for one position in the policy template."""

    band: BandCode
    bundle_kind: BundleKind
    slot_index: int  # 1-based within the bundle
    domain: Domain
    requires_audio: bool = False

    @property
    def global_slot(self) -> int:
        """1-based position in the unrolled 24-slot maximum sequence."""
        band_offsets: dict[BandCode, int] = {"A1": 0, "A2": 8, "B1": 16}
        bundle_offset = 0 if self.bundle_kind == BundleKind.PRIMARY else 4
        return band_offsets[self.band] + bundle_offset + self.slot_index


def _make_bundle(
    band: BandCode, bundle_kind: BundleKind
) -> tuple[PolicySlot, PolicySlot, PolicySlot, PolicySlot]:
    return cast(
        tuple[PolicySlot, PolicySlot, PolicySlot, PolicySlot],
        tuple(
            PolicySlot(
                band=band,
                bundle_kind=bundle_kind,
                slot_index=i + 1,
                domain=dom,
                requires_audio=(dom == Domain.LISTENING_COMPREHENSION),
            )
            for i, dom in enumerate(BUNDLE_SLOT_DOMAINS)
        ),
    )


# Full frozen 24-slot template (only A1/A2/B1; A0 is inferred by failure).
A1_PRIMARY = _make_bundle("A1", BundleKind.PRIMARY)
A1_VERIFICATION = _make_bundle("A1", BundleKind.VERIFICATION)
A2_PRIMARY = _make_bundle("A2", BundleKind.PRIMARY)
A2_VERIFICATION = _make_bundle("A2", BundleKind.VERIFICATION)
B1_PRIMARY = _make_bundle("B1", BundleKind.PRIMARY)
B1_VERIFICATION = _make_bundle("B1", BundleKind.VERIFICATION)


# ---------------------------------------------------------------------------
# Attempt state
# ---------------------------------------------------------------------------


class ResponseOutcome(StrEnum):
    CORRECT = "correct"
    INCORRECT = "incorrect"
    SKIPPED = "skipped"


@dataclass
class BandState:
    """Mutable bundle-level scoring state for one gate band."""

    primary_correct: int = 0
    primary_presented: int = 0
    primary_answered: int = 0
    primary_done: bool = False

    verification_correct: int = 0
    verification_presented: int = 0
    verification_answered: int = 0
    verification_done: bool = False

    @property
    def primary_pass(self) -> bool:
        return self.primary_correct >= PRIMARY_PASS_THRESHOLD

    @property
    def decisive_correct(self) -> int:
        if self.primary_pass:
            return self.primary_correct + self.verification_correct
        return self.primary_correct + self.verification_correct

    @property
    def decisive_evidence(self) -> int:
        """Non-skipped scorable responses in the decisive 8-slot window."""
        return self.primary_answered + self.verification_answered


@dataclass
class AttemptState:
    """Mutable representation of a live assessment attempt."""

    a1: BandState = field(default_factory=BandState)
    a2: BandState = field(default_factory=BandState)
    b1: BandState = field(default_factory=BandState)

    current_band: BandCode = "A1"
    current_bundle: BundleKind = BundleKind.PRIMARY

    # Slots appended so far (1-based positions in the max-16 sequence).
    appended_positions: list[PolicySlot] = field(default_factory=list)

    # Total presented slots (including skipped).
    total_answered: int = 0
    # Non-skipped scorable responses across all bands.
    total_evidence: int = 0

    terminal: bool = False
    result_band: BandCode | None = None
    abandoned: bool = False


# ---------------------------------------------------------------------------
# Slot sequencing
# ---------------------------------------------------------------------------


def next_slots(state: AttemptState) -> tuple[PolicySlot, ...] | None:
    """Return the next bundle of slots to append, or None if terminal."""
    if state.terminal:
        return None

    band = state.current_band
    bundle = state.current_bundle

    mapping: dict[tuple[BandCode, BundleKind], tuple[PolicySlot, ...]] = {
        ("A1", BundleKind.PRIMARY): A1_PRIMARY,
        ("A1", BundleKind.VERIFICATION): A1_VERIFICATION,
        ("A2", BundleKind.PRIMARY): A2_PRIMARY,
        ("A2", BundleKind.VERIFICATION): A2_VERIFICATION,
        ("B1", BundleKind.PRIMARY): B1_PRIMARY,
        ("B1", BundleKind.VERIFICATION): B1_VERIFICATION,
    }
    return mapping.get((band, bundle))


def initial_slots() -> tuple[PolicySlot, ...]:
    """Return the four A1 primary slots that start every assessment."""
    return A1_PRIMARY


# ---------------------------------------------------------------------------
# Policy transition engine
# ---------------------------------------------------------------------------


def record_response(
    state: AttemptState,
    outcome: ResponseOutcome,
    *,
    band: BandCode,
    bundle_kind: BundleKind,
) -> None:
    """Record one scored response into the attempt state (mutates in place).

    A skipped slot increments total_answered but not evidence or correct counts.
    """
    state.total_answered += 1
    band_state: BandState = getattr(state, band.lower())
    if bundle_kind == BundleKind.PRIMARY:
        band_state.primary_presented += 1
    else:
        band_state.verification_presented += 1

    if outcome != ResponseOutcome.SKIPPED:
        state.total_evidence += 1
        if bundle_kind == BundleKind.PRIMARY:
            band_state.primary_answered += 1
            if outcome == ResponseOutcome.CORRECT:
                band_state.primary_correct += 1
        else:
            band_state.verification_answered += 1
            if outcome == ResponseOutcome.CORRECT:
                band_state.verification_correct += 1
    # Skips do not advance evidence counts for that bundle.


def evaluate_transition(state: AttemptState) -> None:
    """Evaluate the current band/bundle state and advance or stop.

    Called after all four slots in the current bundle have been submitted.
    Mutates state.current_band, current_bundle, terminal, result_band, abandoned.
    """
    band = state.current_band
    bundle = state.current_bundle
    band_state: BandState = getattr(state, band.lower())

    if bundle == BundleKind.PRIMARY:
        band_state.primary_done = True
        if band_state.primary_pass:
            # Primary passed — advance to next band.
            if band == "A1":
                state.current_band = "A2"
                state.current_bundle = BundleKind.PRIMARY
            elif band == "A2":
                state.current_band = "B1"
                state.current_bundle = BundleKind.PRIMARY
            elif band == "B1":
                # After B1 primary pass, B1 verification is unconditionally required.
                state.current_bundle = BundleKind.VERIFICATION
        else:
            # Primary failed — open verification for current band.
            state.current_bundle = BundleKind.VERIFICATION

    elif bundle == BundleKind.VERIFICATION:
        band_state.verification_done = True
        # Evaluate stop rule.
        decisive_correct = band_state.decisive_correct
        decisive_evidence = band_state.decisive_evidence

        if decisive_evidence < MIN_DECISIVE_EVIDENCE:
            # Insufficient evidence in decisive window — abandon.
            state.terminal = True
            state.abandoned = True
            return

        if decisive_correct >= VERIFIED_PASS_THRESHOLD:
            # Verified — output this band.
            state.terminal = True
            state.result_band = band
        else:
            # Verified overturn — output the band below.
            state.terminal = True
            if band == "A1":
                state.result_band = "A0"
            elif band == "A2":
                state.result_band = "A1"
            elif band == "B1":
                state.result_band = "A2"


def bundle_complete(state: AttemptState, *, band: BandCode, bundle_kind: BundleKind) -> bool:
    """True when all four slots in the specified bundle have been recorded."""
    band_state: BandState = getattr(state, band.lower())
    presented = (
        band_state.primary_presented
        if bundle_kind == BundleKind.PRIMARY
        else band_state.verification_presented
    )
    return presented >= 4


# ---------------------------------------------------------------------------
# Confidence formula  (§10 of spec)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ConfidenceFactors:
    coverage: float  # C
    margin: float  # M
    agreement: float  # A
    balance: float  # B
    consistency: float  # K
    raw: float
    capped: float
    band: str
    evidence_count: int
    correct_count: int


def _round_half_up(value: float, decimals: int) -> float:
    """Deterministic round-half-up (banker's rounding is not acceptable here)."""
    multiplier = 10**decimals
    return float(math.floor(value * multiplier + 0.5) / multiplier)


def compute_confidence(
    decisive_evidence: int,
    decisive_correct: int,
    *,
    domain_outcomes: dict[Domain, list[ResponseOutcome]],
) -> ConfidenceFactors:
    """Compute the two-decimal, 0.85-capped confidence for a completed result.

    Decisive window = the eight slots (primary+verification) of the terminal band.
    domain_outcomes maps each domain to the list of outcomes in the decisive window.
    Skips contribute zero to evidence and pair agreement denominators.

    Formulas (frozen in §10):
        C = decisive_evidence / 8
        M = (correct - 5.5) / 2.5          if correct >= 6
          = (5.5 - correct) / 5.5           otherwise
        A = fraction of domain pairs where both non-skipped outcomes agree
            (pair with a skip contributes zero)
        B = 1 - (max_domain_rate - min_domain_rate)  when all four domains have evidence
            else 0
        K = (A + B) / 2
        confidence = round_half_up(min(0.85, 0.50*C + 0.30*M + 0.20*K), 2)
    """
    # C — coverage
    c = decisive_evidence / 8.0

    # M — margin from decision boundary
    m = (decisive_correct - 5.5) / 2.5 if decisive_correct >= 6 else (5.5 - decisive_correct) / 5.5

    # Per-domain outcomes in the decisive window.
    domain_scorables: dict[Domain, list[ResponseOutcome]] = {
        dom: [o for o in outcomes if o != ResponseOutcome.SKIPPED]
        for dom, outcomes in domain_outcomes.items()
    }

    # A — pair agreement: each domain contributes (1 if both non-skipped agree, 0 otherwise).
    agreement_pairs: list[float] = []
    for dom in Domain:
        scorable = domain_scorables.get(dom, [])
        if len(scorable) >= 2:
            # Two outcomes in the decisive window for this domain.
            first, second = scorable[0], scorable[1]
            agreement_pairs.append(1.0 if first == second else 0.0)
        elif len(scorable) == 1:
            # Only one non-skipped response — contributes zero (a pair needs two).
            agreement_pairs.append(0.0)
        else:
            # Both slots skipped — pair contributes zero.
            agreement_pairs.append(0.0)

    a = sum(agreement_pairs) / len(agreement_pairs) if agreement_pairs else 0.0

    # B — cross-domain balance.
    domain_rates: list[float] = []
    for dom in Domain:
        scorable = domain_scorables.get(dom, [])
        if scorable:
            rate = sum(1.0 for o in scorable if o == ResponseOutcome.CORRECT) / len(scorable)
            domain_rates.append(rate)

    b = 1.0 - (max(domain_rates) - min(domain_rates)) if len(domain_rates) == 4 else 0.0

    k = (a + b) / 2.0
    raw = 0.50 * c + 0.30 * m + 0.20 * k
    capped = _round_half_up(min(CONFIDENCE_CAP, raw), 2)

    # Determine band.
    band = "low"
    for threshold, label in CONFIDENCE_BAND_THRESHOLDS:
        if capped >= threshold:
            band = label
            break

    return ConfidenceFactors(
        coverage=c,
        margin=m,
        agreement=a,
        balance=b,
        consistency=k,
        raw=raw,
        capped=capped,
        band=band,
        evidence_count=decisive_evidence,
        correct_count=decisive_correct,
    )


# ---------------------------------------------------------------------------
# Assessed skills derivation
# ---------------------------------------------------------------------------


def assessed_skills(
    domain_outcomes: dict[Domain, list[ResponseOutcome]],
) -> list[str]:
    """Return skills with at least one non-skipped scorable response.

    v1 never infers production. Only recognition and listening are possible.
    """
    skills: list[str] = []
    recognition_domains = {
        Domain.VOCABULARY_RECOGNITION,
        Domain.GRAMMAR_IN_CONTEXT,
        Domain.READING_COMPREHENSION,
    }
    has_recognition = any(
        any(o != ResponseOutcome.SKIPPED for o in domain_outcomes.get(d, []))
        for d in recognition_domains
    )
    has_listening = any(
        o != ResponseOutcome.SKIPPED
        for o in domain_outcomes.get(Domain.LISTENING_COMPREHENSION, [])
    )
    if has_recognition:
        skills.append("recognition")
    if has_listening:
        skills.append("listening")
    return skills
