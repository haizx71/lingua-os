import { describe, it, expect } from 'vitest';
import {
  parseBrainConceptResponse,
  parseBrainSummaryResponse,
  parseBrainConceptListResponse,
  runPhaseELearningLoop,
  isProjectionNumberEquivalent,
  expectProjectionNumberEquivalent,
  PROJECTION_NUMERIC_TOLERANCE,
} from './phase_e_runner';
import type { FrllCleanupReport } from './phase_b_runner';
import type { LearnerStateDigest } from './postgres_probe_client';
import type { ReviewAnswerLearnerContext } from './phase_d_runner';

describe('Phase E Runner Static Invariants & Fail-Closed Behavior', () => {
  it('fails closed when external Supabase credentials are not present in process environment', async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalSecret = process.env.SUPABASE_SECRET_KEY;
    const originalRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(runPhaseELearningLoop()).rejects.toThrow();
    } finally {
      if (originalUrl) process.env.SUPABASE_URL = originalUrl;
      if (originalSecret) process.env.SUPABASE_SECRET_KEY = originalSecret;
      if (originalRole) process.env.SUPABASE_SERVICE_ROLE_KEY = originalRole;
    }
  });

  describe('parseBrainConceptResponse', () => {
    const sampleValidResponse = {
      data: {
        concept: {
          id: '7f110000-0000-4000-8000-000000000004',
          languageCode: 'en',
          canonicalForm: 'frll-anchor',
          partOfSpeech: 'noun',
          definitions: [
            {
              definition: 'A test anchor concept',
              translation: 'Khái niệm neo thử nghiệm',
              languageCode: 'en',
              order: 1,
            },
          ],
          examples: [],
          relations: [],
          learner: {
            status: 'learning',
            isDue: false,
            exposureCount: 0,
            lastSeenAt: null,
            memory: {
              state: 'learning',
              dueAt: '2026-09-07T08:00:00Z',
              lastReviewedAt: '2026-09-06T08:00:00Z',
              isDue: false,
            },
            competence: {
              recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
              listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
              production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
            },
          },
        },
        status: 'learning',
        competence: {
          recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
          listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
          production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
        },
        mastery: null,
        confidence: 0.6,
        memory: {
          state: 'learning',
          dueAt: '2026-09-07T08:00:00Z',
          lastReviewedAt: '2026-09-06T08:00:00Z',
          isDue: false,
        },
        evidence: {
          exposureCount: 0,
          reviewCount: 1,
          lastReviewedAt: '2026-09-06T08:00:00Z',
        },
      },
      meta: { requestId: 'req-123' },
    };

    it('correctly parses canonical FastAPI/OpenAPI BrainConceptResponse', () => {
      const parsed = parseBrainConceptResponse(sampleValidResponse);
      expect(parsed.concept.id).toBe('7f110000-0000-4000-8000-000000000004');
      expect(parsed.concept.canonicalForm).toBe('frll-anchor');
      expect(parsed.status).toBe('learning');
      expect(parsed.mastery).toBeNull();
      expect(parsed.confidence).toBe(0.6);
      expect(parsed.competence.production.score).toBe(0.85);
      expect(parsed.competence.production.evidenceCount).toBe(1);
      expect(parsed.memory?.state).toBe('learning');
      expect(parsed.evidence.reviewCount).toBe(1);
    });

    it('throws descriptive error if missing data envelope or invalid fields', () => {
      expect(() => parseBrainConceptResponse(null)).toThrow('missing data envelope');
      expect(() => parseBrainConceptResponse({})).toThrow('missing data envelope');
      expect(() => parseBrainConceptResponse({ data: {} })).toThrow('missing or invalid data.concept');
      expect(() =>
        parseBrainConceptResponse({
          data: { concept: { id: '', canonicalForm: 'a' } },
        })
      ).toThrow('data.concept.id is missing or invalid');
    });
  });

  describe('parseBrainSummaryResponse', () => {
    it('correctly parses canonical BrainSummaryResponse', () => {
      const parsed = parseBrainSummaryResponse({
        data: {
          languageProfileId: '22222222-2222-4222-8222-222222222222',
          statusCounts: {
            total: 1,
            unseen: 0,
            discovered: 0,
            learning: 1,
            active: 0,
            retained: 0,
            mastered: 0,
          },
          dueCount: 0,
          memoryHealth: null,
          competence: {
            recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
            listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
            production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
          },
          recentConcepts: [],
          calculatedAt: '2026-09-06T08:00:00Z',
        },
      });

      expect(parsed.languageProfileId).toBe('22222222-2222-4222-8222-222222222222');
      expect(parsed.statusCounts.learning).toBe(1);
      expect(parsed.dueCount).toBe(0);
    });
  });

  describe('parseBrainConceptListResponse', () => {
    it('correctly parses canonical BrainConceptListResponse', () => {
      const parsed = parseBrainConceptListResponse({
        data: [
          {
            concept: {
              id: '7f110000-0000-4000-8000-000000000004',
              canonicalForm: 'frll-anchor',
              status: 'learning',
              isDue: false,
            },
            competence: {
              recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
              listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
              production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
            },
            mastery: null,
            confidence: 0.6,
            memory: {
              state: 'learning',
              dueAt: '2026-09-07T08:00:00Z',
              lastReviewedAt: '2026-09-06T08:00:00Z',
              isDue: false,
            },
            exposureCount: 0,
          },
        ],
        meta: {
          requestId: 'req-456',
          hasMore: false,
          pageSize: 1,
        },
      });

      expect(parsed.items.length).toBe(1);
      expect(parsed.items[0].concept.id).toBe('7f110000-0000-4000-8000-000000000004');
      expect(parsed.items[0].concept.status).toBe('learning');
    });
  });

  describe('Phase E Execution & Seam-Driven Proof (FRLL-12)', () => {
    const mockContext: ReviewAnswerLearnerContext = {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'frll-phase-e-test@example.com',
        user_metadata: {},
        app_metadata: {},
        aud: 'authenticated',
        created_at: '2026-09-06T08:00:00Z',
      },
      session: {
        accessToken: 'mock-access-token',
        tokenType: 'bearer',
        expiresIn: 3600,
        expiresAt: Date.now() + 3600000,
      },
      apiBaseUrl: 'http://localhost:8000',
      meResponse: {
        user: { id: '11111111-1111-4111-8111-111111111111', email: 'frll-phase-e-test@example.com', state: 'active' },
        learnerProfile: { id: '11111111-1111-4111-8111-111111111111', timeZone: 'Asia/Ho_Chi_Minh', theme: 'system', reduceMotion: false },
        activeLanguageProfile: null,
      },
      meEtag: 'W/"mock-etag"',
      languageProfileId: '22222222-2222-4222-8222-222222222222',
      conceptId: '7f110000-0000-4000-8000-000000000004',
      firstSaveResponse: { status: 'created' },
      postSaveDigest: {} as any,
      todayPlan: {
        id: '33333333-3333-4333-8333-333333333333',
        planDate: '2026-09-06',
        timeZone: 'Asia/Ho_Chi_Minh',
        engineVersion: 'today-heuristic-v1',
        asOf: '2026-09-06T08:00:00Z',
        activities: [],
      },
      reviewActivity: {
        id: 'activity-1',
        activityType: 'review',
        targetCount: 1,
        completedCount: 0,
        reasonCodes: ['FSRS_DUE'],
      },
      reviewItemId: '44444444-4444-4444-8444-444444444444',
      handoff: {
        reviewItemId: '44444444-4444-4444-8444-444444444444',
        conceptId: '7f110000-0000-4000-8000-000000000004',
        canonicalForm: 'frll-anchor',
        reasonCodes: ['FSRS_DUE'],
      },
      postTodayDigest: {} as any,
      actorId: '11111111-1111-4111-8111-111111111111',
      reviewEventId: '66666666-6666-4666-8666-666666666666',
      reviewLearningEventId: '77777777-7777-4777-8777-777777777777',
      idempotencyKey: '88888888-8888-4888-8888-888888888888',
      queueItem: {
        reviewItemId: '44444444-4444-4444-8444-444444444444',
        concept: {
          id: '7f110000-0000-4000-8000-000000000004',
          canonicalForm: 'frll-anchor',
          status: 'learning',
          isDue: true,
        },
        exerciseMode: 'self_recall',
        prompt: { promptText: 'frll-anchor' },
        memory: { state: 'new', dueAt: '2026-09-06T08:00:00Z', isDue: true },
        competence: {
          recognition: { score: 0, confidence: 0, evidenceCount: 0 },
          listening: { score: 0, confidence: 0, evidenceCount: 0 },
          production: { score: 0, confidence: 0, evidenceCount: 0 },
        },
      },
      firstAnswerResponse: {
        reviewItemId: '44444444-4444-4444-8444-444444444444',
        memory: {
          state: 'learning',
          dueAt: '2026-09-07T08:00:00Z',
          lastReviewedAt: '2026-09-06T08:00:00Z',
          isDue: false,
        },
        competence: {
          recognition: { score: 0, confidence: 0, evidenceCount: 0 },
          listening: { score: 0, confidence: 0, evidenceCount: 0 },
          production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
        },
        remainingDueCount: 0,
      },
      preAnswerDigest: {} as any,
      postReviewDigest: {
        user_id: '11111111-1111-4111-8111-111111111111',
        concept_id: '7f110000-0000-4000-8000-000000000004',
        user_exists: true,
        profile_time_zone: 'Asia/Ho_Chi_Minh',
        language_profile_ids: ['22222222-2222-4222-8222-222222222222'],
        is_concept_saved: true,
        save_intent_count: 1,
        save_intent_ids: ['55555555-5555-4555-8555-555555555555'],
        review_item_count: 1,
        review_item_ids: ['44444444-4444-4444-8444-444444444444'],
        fsrs_state_count: 1,
        fsrs_states: [
          {
            review_item_id: '44444444-4444-4444-8444-444444444444',
            state: 'learning',
            state_version: 2,
            due_at: '2026-09-07T08:00:00Z',
            last_review_at: '2026-09-06T08:00:00Z',
          },
        ],
        review_event_count: 1,
        review_events: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            review_item_id: '44444444-4444-4444-8444-444444444444',
            idempotency_key: '88888888-8888-4888-8888-888888888888',
            rating: 'good',
            response_time_ms: 1500,
            has_memory_snapshot: true,
            has_competence_snapshot: true,
          },
        ],
        learning_event_count: 2,
        learning_events: [
          { event_type: 'learning.concept.saved.v1', source_type: 'concept_save_intent' },
          { event_type: 'learning.review.completed.v1', source_type: 'review_event', source_event_id: '66666666-6666-4666-8666-666666666666', ingestion_sequence: 2 },
        ],
        concept_state: {
          status: 'learning',
          state_version: 2,
          has_learning_intent: true,
          has_projectable_evidence: true,
          mastery: null,
          confidence: 0.6,
          production: 0.85,
          production_confidence: 0.6,
          production_evidence_count: 1,
          recognition: 0.5,
          recognition_evidence_count: 0,
          listening: 0.5,
          listening_evidence_count: 0,
        },
        skill_states: [],
        today_plan_count: 1,
        today_plan_ids: ['33333333-3333-4333-8333-333333333333'],
        today_activity_review_item_ids: ['44444444-4444-4444-8444-444444444444'],
        today_plans: [{ id: '33333333-3333-4333-8333-333333333333' }],
        today_activities: [{ id: 'activity-1' }],
      },
    };

    function createMockBrainFetch(customDetail?: any) {
      return async (url: string | URL | Request): Promise<Response> => {
        const urlStr = String(url);

        if (urlStr.includes('/v1/brain/concepts/7f110000-0000-4000-8000-000000000004')) {
          const detailData = customDetail ?? {
            concept: {
              id: '7f110000-0000-4000-8000-000000000004',
              languageCode: 'en',
              canonicalForm: 'frll-anchor',
              partOfSpeech: 'noun',
              definitions: [],
              examples: [],
              relations: [],
              learner: {
                status: 'learning',
                isDue: false,
                exposureCount: 0,
                lastSeenAt: null,
                memory: {
                  state: 'learning',
                  dueAt: '2026-09-07T08:00:00Z',
                  lastReviewedAt: '2026-09-06T08:00:00Z',
                  isDue: false,
                },
                competence: {
                  recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
                  listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
                  production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
                },
              },
            },
            status: 'learning',
            competence: {
              recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
              listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
              production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
            },
            mastery: null,
            confidence: 0.6,
            memory: {
              state: 'learning',
              dueAt: '2026-09-07T08:00:00Z',
              lastReviewedAt: '2026-09-06T08:00:00Z',
              isDue: false,
            },
            evidence: {
              exposureCount: 0,
              reviewCount: 1,
              lastSeenAt: null,
              lastReviewedAt: '2026-09-06T08:00:00Z',
            },
          };
          return new Response(JSON.stringify({ data: detailData, meta: { requestId: 'req-1' } }), {
            status: 200,
          });
        }

        if (urlStr.includes('/v1/brain/summary')) {
          return new Response(
            JSON.stringify({
              data: {
                languageProfileId: '22222222-2222-4222-8222-222222222222',
                statusCounts: {
                  total: 1,
                  unseen: 0,
                  discovered: 0,
                  learning: 1,
                  active: 0,
                  retained: 0,
                  mastered: 0,
                },
                dueCount: 0,
                memoryHealth: null,
                competence: {
                  recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
                  listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
                  production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
                },
                recentConcepts: [
                  {
                    concept: {
                      id: '7f110000-0000-4000-8000-000000000004',
                      canonicalForm: 'frll-anchor',
                      status: 'learning',
                      isDue: false,
                    },
                    competence: {
                      recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
                      listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
                      production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
                    },
                    mastery: null,
                    confidence: 0.6,
                    memory: {
                      state: 'learning',
                      dueAt: '2026-09-07T08:00:00Z',
                      lastReviewedAt: '2026-09-06T08:00:00Z',
                      isDue: false,
                    },
                    exposureCount: 0,
                  },
                ],
                calculatedAt: '2026-09-06T08:00:00Z',
              },
            }),
            { status: 200 }
          );
        }

        if (urlStr.includes('/v1/brain/concepts')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  concept: {
                    id: '7f110000-0000-4000-8000-000000000004',
                    canonicalForm: 'frll-anchor',
                    status: 'learning',
                    isDue: false,
                  },
                  competence: {
                    recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
                    listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
                    production: { score: 0.85, confidence: 0.6, evidenceCount: 1 },
                  },
                  mastery: null,
                  confidence: 0.6,
                  memory: {
                    state: 'learning',
                    dueAt: '2026-09-07T08:00:00Z',
                    lastReviewedAt: '2026-09-06T08:00:00Z',
                    isDue: false,
                  },
                  exposureCount: 0,
                },
              ],
              meta: {
                requestId: 'req-list-1',
                hasMore: false,
                pageSize: 1,
              },
            }),
            { status: 200 }
          );
        }

        return new Response('{}', { status: 200 });
      };
    }

    const validTeardownReport: FrllCleanupReport = {
      authDeleted: true,
      postgresClean: true,
      postgresDetails: {
        user_id: '11111111-1111-4111-8111-111111111111',
        clean: true,
        counts: {
          users: 0,
          learner_profiles: 0,
          user_languages: 0,
          review_items: 0,
          fsrs_states: 0,
          learning_events: 0,
          concept_save_intents: 0,
          profile_mutation_results: 0,
          user_concept_states: 0,
          user_saved_concepts: 0,
          today_plans: 0,
          today_plan_activities: 0,
          today_activity_review_items: 0,
          review_events: 0,
        },
        anchor_concept_intact: true,
      },
    };

    it('proves happy path: Brain projects authoritative competence without synthetic fallback, GET is read-only, and cleanup passes', async () => {
      const report = await runPhaseELearningLoop({
        seams: {
          setupThroughReviewAnswer: async (opts) => {
            opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
            return mockContext;
          },
          fetchFn: createMockBrainFetch() as any,
          captureDigest: async () => mockContext.postReviewDigest,
          teardownLearner: async () => validTeardownReport,
        },
      });

      expect(report.success).toBe(true);
      expect(report.userId).toBe('11111111-1111-4111-8111-111111111111');
      expect(report.conceptId).toBe('7f110000-0000-4000-8000-000000000004');
      expect(report.cleanupVerified).toBe(true);

      // Brain detail assertions (FRLL-12)
      expect(report.brainConceptDetail.status).toBe('learning');
      expect(report.brainConceptDetail.memory).not.toBeNull();
      expect(report.brainConceptDetail.memory?.state).toBe('learning');
      expect(report.brainConceptDetail.competence.production.evidenceCount).toBe(1);
      expect(report.brainConceptDetail.competence.production.score).toBe(0.85);
      expect(report.brainConceptDetail.evidence.reviewCount).toBe(1);

      // Brain summary & list assertions
      expect(report.brainSummary?.statusCounts.learning).toBe(1);
      expect(report.brainConceptList?.items.length).toBe(1);
      expect(report.brainConceptList?.items[0].concept.id).toBe('7f110000-0000-4000-8000-000000000004');
    });

    it('fails closed if Brain returns synthetic-zero status "unseen" despite persisted Review evidence', async () => {
      const syntheticZeroDetail = {
        concept: {
          id: '7f110000-0000-4000-8000-000000000004',
          languageCode: 'en',
          canonicalForm: 'frll-anchor',
          definitions: [],
          examples: [],
          relations: [],
          learner: {
            status: 'unseen',
            isDue: false,
            exposureCount: 0,
            competence: {
              recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
              listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
              production: { score: 0.5, confidence: 0, evidenceCount: 0 },
            },
          },
        },
        status: 'unseen',
        competence: {
          recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
          listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
          production: { score: 0.5, confidence: 0, evidenceCount: 0 },
        },
        mastery: null,
        confidence: 0,
        memory: null,
        evidence: {
          exposureCount: 0,
          reviewCount: 0,
        },
      };

      await expect(
        runPhaseELearningLoop({
          seams: {
            setupThroughReviewAnswer: async (opts) => {
              opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
              return mockContext;
            },
            fetchFn: createMockBrainFetch(syntheticZeroDetail) as any,
            captureDigest: async () => mockContext.postReviewDigest,
            teardownLearner: async () => validTeardownReport,
          },
        })
      ).rejects.toThrow('FRLL-12 failure: Brain returned synthetic-zero status "unseen"');
    });

    it('fails closed if Brain projection score differs from PostgreSQL authority', async () => {
      const divergentDetail = {
        concept: {
          id: '7f110000-0000-4000-8000-000000000004',
          languageCode: 'en',
          canonicalForm: 'frll-anchor',
          definitions: [],
          examples: [],
          relations: [],
          learner: {
            status: 'learning',
            isDue: false,
            exposureCount: 0,
            memory: {
              state: 'learning',
              dueAt: '2026-09-07T08:00:00Z',
              lastReviewedAt: '2026-09-06T08:00:00Z',
              isDue: false,
            },
            competence: {
              recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
              listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
              production: { score: 0.42, confidence: 0.6, evidenceCount: 1 }, // Divergent!
            },
          },
        },
        status: 'learning',
        competence: {
          recognition: { score: 0.5, confidence: 0, evidenceCount: 0 },
          listening: { score: 0.5, confidence: 0, evidenceCount: 0 },
          production: { score: 0.42, confidence: 0.6, evidenceCount: 1 }, // Divergent!
        },
        mastery: null,
        confidence: 0.6,
        memory: {
          state: 'learning',
          dueAt: '2026-09-07T08:00:00Z',
          lastReviewedAt: '2026-09-06T08:00:00Z',
          isDue: false,
        },
        evidence: {
          exposureCount: 0,
          reviewCount: 1,
          lastReviewedAt: '2026-09-06T08:00:00Z',
        },
      };

      await expect(
        runPhaseELearningLoop({
          seams: {
            setupThroughReviewAnswer: async (opts) => {
              opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
              return mockContext;
            },
            fetchFn: createMockBrainFetch(divergentDetail) as any,
            captureDigest: async () => mockContext.postReviewDigest,
            teardownLearner: async () => validTeardownReport,
          },
        })
      ).rejects.toThrow(
        /FRLL-12 failure: Brain production score 0\.42 != PostgreSQL 0\.85/
      );
    });

    it('fails closed if Brain GET mutates learner state (read-only invariant violation)', async () => {
      let digestCallCount = 0;
      const mutatedPostDigest: LearnerStateDigest = {
        ...mockContext.postReviewDigest,
        review_event_count: 2, // Unexpected write!
      };

      await expect(
        runPhaseELearningLoop({
          seams: {
            setupThroughReviewAnswer: async (opts) => {
              opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
              return mockContext;
            },
            fetchFn: createMockBrainFetch() as any,
            captureDigest: async () => {
              digestCallCount++;
              if (digestCallCount === 1) {
                return mockContext.postReviewDigest; // pre-Brain
              }
              return mutatedPostDigest; // post-Brain mutated!
            },
            teardownLearner: async () => validTeardownReport,
          },
        })
      ).rejects.toThrow('Read-only invariant violated: review_event_count mutated');
    });

    it('fails closed if teardown reports dirty database state', async () => {
      const dirtyReport: FrllCleanupReport = {
        authDeleted: true,
        postgresClean: false,
        postgresDetails: {
          ...validTeardownReport.postgresDetails,
          clean: false,
          counts: {
            ...validTeardownReport.postgresDetails.counts,
            user_concept_states: 1,
          },
        },
      };

      await expect(
        runPhaseELearningLoop({
          seams: {
            setupThroughReviewAnswer: async (opts) => {
              opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
              return mockContext;
            },
            fetchFn: createMockBrainFetch() as any,
            captureDigest: async () => mockContext.postReviewDigest,
            teardownLearner: async () => dirtyReport,
          },
        })
      ).rejects.toThrow('FRLL Phase E cleanup failure');
    });
  });

  describe('Canonical Numeric Comparison Policy (FRLL-12)', () => {
    it('accepts canonical Brain API representation (0.03333333) vs PostgreSQL Decimal probe (0.033333333)', () => {
      expect(isProjectionNumberEquivalent(0.03333333, 0.033333333)).toBe(true);
      expect(isProjectionNumberEquivalent('0.03333333', '0.033333333')).toBe(true);
      expect(() =>
        expectProjectionNumberEquivalent(0.03333333, 0.033333333, 'Brain confidence')
      ).not.toThrow();
      expect(() =>
        expectProjectionNumberEquivalent(0.03333333, '0.033333333', 'Brain confidence')
      ).not.toThrow();
    });

    it('fails closed on a difference just beyond the accepted scale-8 precision bound (1.1e-8)', () => {
      const beyondTolerance = 0.03333333 + 1.1e-8;
      expect(isProjectionNumberEquivalent(0.03333333, beyondTolerance)).toBe(false);
      expect(() =>
        expectProjectionNumberEquivalent(0.03333333, beyondTolerance, 'Brain confidence')
      ).toThrow(/FRLL-12 failure: Brain confidence .* > tolerance 1e-8/);
    });

    it('accepts exact equal numeric values and strings', () => {
      expect(isProjectionNumberEquivalent(0.5, 0.5)).toBe(true);
      expect(isProjectionNumberEquivalent('0.5', 0.5)).toBe(true);
      expect(isProjectionNumberEquivalent(0, 0)).toBe(true);
      expect(() =>
        expectProjectionNumberEquivalent(0.5, 0.5, 'Brain recognition score')
      ).not.toThrow();
    });

    it('accepts null/undefined equivalence for unreached mastery', () => {
      expect(isProjectionNumberEquivalent(null, null)).toBe(true);
      expect(isProjectionNumberEquivalent(undefined, undefined)).toBe(true);
      expect(isProjectionNumberEquivalent(null, undefined)).toBe(true);
      expect(() =>
        expectProjectionNumberEquivalent(null, null, 'Brain mastery')
      ).not.toThrow();
    });

    it('fails closed on mismatched null/undefined', () => {
      expect(isProjectionNumberEquivalent(null, 0.5)).toBe(false);
      expect(isProjectionNumberEquivalent(0.5, null)).toBe(false);
      expect(() =>
        expectProjectionNumberEquivalent(null, 0.5, 'Brain mastery')
      ).toThrow('FRLL-12 failure: Brain mastery is null (expected 0.5).');
      expect(() =>
        expectProjectionNumberEquivalent(0.5, null, 'Brain mastery')
      ).toThrow('FRLL-12 failure: Brain mastery is 0.5 (expected null).');
    });

    it('fails closed on materially divergent values (e.g. 0.04 vs 0.03333333)', () => {
      expect(isProjectionNumberEquivalent(0.04, 0.03333333)).toBe(false);
      expect(() =>
        expectProjectionNumberEquivalent(0.04, 0.03333333, 'Brain confidence')
      ).toThrow(/FRLL-12 failure: Brain confidence 0\.04 != PostgreSQL 0\.03333333/);
    });

    it('fails closed on materially divergent production score (e.g. 0.42 vs 0.85)', () => {
      expect(isProjectionNumberEquivalent(0.42, 0.85)).toBe(false);
      expect(() =>
        expectProjectionNumberEquivalent(0.42, 0.85, 'Brain production score')
      ).toThrow(/FRLL-12 failure: Brain production score 0\.42 != PostgreSQL 0\.85/);
    });

    it('fails closed when actual or expected is NaN', () => {
      expect(isProjectionNumberEquivalent(NaN, 0.5)).toBe(false);
      expect(isProjectionNumberEquivalent(0.5, NaN)).toBe(false);
      expect(isProjectionNumberEquivalent(NaN, NaN)).toBe(false);
      expect(() =>
        expectProjectionNumberEquivalent(NaN, 0.5, 'Brain confidence')
      ).toThrow('FRLL-12 failure: Brain confidence actual value is not a finite number (NaN).');
      expect(() =>
        expectProjectionNumberEquivalent(0.5, NaN, 'Brain confidence')
      ).toThrow('FRLL-12 failure: Brain confidence expected value is not a finite number (NaN).');
    });

    it('fails closed when actual or expected is Infinity or -Infinity', () => {
      expect(isProjectionNumberEquivalent(Infinity, 0.5)).toBe(false);
      expect(isProjectionNumberEquivalent(0.5, -Infinity)).toBe(false);
      expect(() =>
        expectProjectionNumberEquivalent(Infinity, 0.5, 'Brain confidence')
      ).toThrow('FRLL-12 failure: Brain confidence actual value is not a finite number (Infinity).');
      expect(() =>
        expectProjectionNumberEquivalent(0.5, -Infinity, 'Brain confidence')
      ).toThrow('FRLL-12 failure: Brain confidence expected value is not a finite number (-Infinity).');
    });
  });
});
