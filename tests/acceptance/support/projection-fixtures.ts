/** Static persisted rows for harness unit tests, not a competence implementation. */
export const profileId = '22222222-2222-4222-8222-222222222222';
export const parameterId = '00000000-0000-4000-8600-000000000002';
export const parameterVersion = 'competence-beta-v1';
export const reviewedAt = '2026-09-06T08:00:00Z';
export const parameterLineage = {
  competence_parameter_set_id: parameterId,
  competence_parameter_version: parameterVersion,
  projection_method_version: parameterVersion,
};
export const priorConcept = {
  ...parameterLineage,
  status: 'learning', state_version: 2, has_learning_intent: true, has_projectable_evidence: false,
  mastery: null, confidence: 0,
  recognition: 0.5, recognition_confidence: 0, recognition_evidence_count: 0,
  recognition_positive_mass: '0', recognition_negative_mass: '0', recognition_last_evidence_at: null,
  listening: 0.5, listening_confidence: 0, listening_evidence_count: 0,
  listening_positive_mass: '0', listening_negative_mass: '0', listening_last_evidence_at: null,
  production: 0.5, production_confidence: 0, production_evidence_count: 0,
  production_positive_mass: '0', production_negative_mass: '0', production_last_evidence_at: null,
};
export const reviewedConcept = {
  ...priorConcept, state_version: 3, has_projectable_evidence: true, confidence: 0.6,
  production: 0.85, production_confidence: 0.6, production_evidence_count: 1,
  production_positive_mass: '1', production_negative_mass: '0', production_last_evidence_at: reviewedAt,
};
export const priorSkills = ['recognition', 'listening', 'production'].map(skill => ({
  user_language_id: profileId, skill, score: 0.5, confidence: 0, evidence_count: 0,
  positive_mass: '0', negative_mass: '0', last_evidence_at: null as string | null,
  state_version: 1, method_version: parameterVersion,
  competence_parameter_set_id: parameterId, competence_parameter_version: parameterVersion,
}));
export const reviewedSkills = [priorSkills[0], priorSkills[1], {
  ...priorSkills[2], score: 0.85, confidence: 0.6, evidence_count: 1,
  positive_mass: '1', last_evidence_at: reviewedAt, state_version: 2,
}];
export const priorHead = {
  user_language_id: profileId, next_ingestion_sequence: 2, state_version: 2,
  parameter_set_id: parameterId, parameter_version: parameterVersion,
  projection_method_version: parameterVersion,
};
export const reviewedHead = { ...priorHead, next_ingestion_sequence: 3, state_version: 3 };
export const reviewedSignals = {
  recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
  listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
  production: { score: 0.85, confidence: 0.6, evidenceCount: 1, updatedAt: reviewedAt },
};
export const committedCompetenceSnapshot = {
  recognition: { ...reviewedSignals.recognition, updatedAt: null },
  listening: { ...reviewedSignals.listening, updatedAt: null },
  production: reviewedSignals.production,
};
export const committedMemorySnapshot = {
  reviewItemId: '44444444-4444-4444-8444-444444444444', state: 'learning',
  dueAt: '2026-09-07T08:00:00Z', lastReviewAt: reviewedAt,
  difficulty: 2, stability: 1, step: 0, stateVersion: 2,
  parameterSetId: parameterId, paramsVersion: 'fsrs-6-default-v1',
};
