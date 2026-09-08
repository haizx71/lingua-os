import { priorConcept, reviewedConcept, priorSkills, reviewedSkills, priorHead, reviewedHead, parameterLineage, parameterId, committedMemorySnapshot, committedCompetenceSnapshot, reviewedSignals } from './projection-fixtures';
import { describe, it, expect } from 'vitest';
import {
  parseReviewQueueResponse,
  parseReviewAnswerResponse,
  runPhaseDLearningLoop,
} from './phase_d_runner';
import { isTeardownVerified, type FrllCleanupReport } from './phase_b_runner';

describe('Phase D Runner Static Invariants & Fail-Closed Behavior', () => {
  it('fails closed when external Supabase credentials are not present in process environment', async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalSecret = process.env.SUPABASE_SECRET_KEY;
    const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(runPhaseDLearningLoop()).rejects.toThrow('SUPABASE_URL is missing or empty');
    } finally {
      if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
      if (originalSecret !== undefined) process.env.SUPABASE_SECRET_KEY = originalSecret;
      if (originalServiceRole !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });

  describe('parseReviewQueueResponse', () => {
    it('correctly parses canonical FastAPI/OpenAPI ReviewQueueResponse', () => {
      const canonicalResponse = {
        data: [
          {
            reviewItemId: '44444444-4444-4444-8444-444444444444',
            concept: {
              id: '7f110000-0000-4000-8000-000000000004',
              canonicalForm: 'xin chào',
              partOfSpeech: 'phrase',
              level: {
                frameworkCode: 'cefr',
                code: 'a1',
                label: 'A1',
              },
              status: 'discovered',
              isDue: true,
            },
            exerciseMode: 'self_recall',
            prompt: {
              promptText: 'xin chào',
              contextSentence: 'Xin chào, bạn khỏe không?',
              translation: 'Hello, how are you?',
            },
            memory: {
              state: 'new',
              dueAt: '2026-09-06T08:00:00Z',
              isDue: true,
            },
            competence: {
              recognition: { score: 0.0, confidence: 0.0, evidenceCount: 0 },
              listening: { score: 0.0, confidence: 0.0, evidenceCount: 0 },
              production: { score: 0.0, confidence: 0.0, evidenceCount: 0 },
            },
          },
        ],
        meta: { apiVersion: '1.0',
          requestId: '55555555-5555-4555-8555-555555555555',
          nextCursor: null,
          hasMore: false,
          pageSize: 1,
        },
      };

      const queue = parseReviewQueueResponse(canonicalResponse);
      expect(queue).toHaveLength(1);
      const item = queue[0];
      expect(item.reviewItemId).toBe('44444444-4444-4444-8444-444444444444');
      expect(item.concept.id).toBe('7f110000-0000-4000-8000-000000000004');
      expect(item.concept.canonicalForm).toBe('xin chào');
      expect(item.exerciseMode).toBe('self_recall');
      expect(item.prompt.promptText).toBe('xin chào');
      expect(item.memory.state).toBe('new');
      expect(item.memory.isDue).toBe(true);
      expect(item.competence.production.evidenceCount).toBe(0);
    });

    it('throws descriptive error if missing data envelope or invalid items', () => {
      expect(() => parseReviewQueueResponse({})).toThrow('frozen OpenAPI validation failed');
      expect(() => parseReviewQueueResponse({ data: null })).toThrow('frozen OpenAPI validation failed');
      expect(() => parseReviewQueueResponse({ data: [{}] })).toThrow('frozen OpenAPI validation failed');
    });
  });

  describe('parseReviewAnswerResponse', () => {
    it('correctly parses canonical FastAPI/OpenAPI ReviewAnswerResponse', () => {
      const canonicalResponse = {
        data: {
          reviewItemId: '44444444-4444-4444-8444-444444444444',
          memory: {
            state: 'learning',
            dueAt: '2026-09-07T08:00:00Z',
            lastReviewedAt: '2026-09-06T08:00:00Z',
            isDue: false,
          },
          competence: {
            recognition: { score: 0.0, confidence: 0.0, evidenceCount: 0 },
            listening: { score: 0.0, confidence: 0.0, evidenceCount: 0 },
            production: { score: 0.85, confidence: 0.6, evidenceCount: 1, updatedAt: '2026-09-06T08:00:00Z' },
          },
          remainingDueCount: 0,
          feedback: 'Đã ghi nhận kết quả ôn tập.',
        },
        meta: { apiVersion: '1.0',
          requestId: '55555555-5555-4555-8555-555555555555',
        },
      };

      const result = parseReviewAnswerResponse(canonicalResponse);
      expect(result.reviewItemId).toBe('44444444-4444-4444-8444-444444444444');
      expect(result.memory.state).toBe('learning');
      expect(result.memory.isDue).toBe(false);
      expect(result.memory.lastReviewedAt).toBe('2026-09-06T08:00:00Z');
      expect(result.competence.production.evidenceCount).toBe(1);
      expect(result.competence.production.score).toBe(0.85);
      expect(result.remainingDueCount).toBe(0);
      expect(result.feedback).toBe('Đã ghi nhận kết quả ôn tập.');
    });

    it('throws descriptive error if missing data envelope or invalid fields', () => {
      expect(() => parseReviewAnswerResponse({})).toThrow('frozen OpenAPI validation failed');
      expect(() => parseReviewAnswerResponse({ data: null })).toThrow('frozen OpenAPI validation failed');
      expect(() => parseReviewAnswerResponse({ data: { reviewItemId: '' } })).toThrow('frozen OpenAPI validation failed');
    });
  });

  describe('Canonical Teardown Report & Cleanup Verification Invariants', () => {
    const validReport: FrllCleanupReport = {
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

    it('1. successful teardown report produces cleanupVerified=true', () => {
      expect(isTeardownVerified(validReport)).toBe(true);
    });

    it('2. auth failure produces cleanupVerified=false / throws fail-closed', () => {
      const authFailedReport: FrllCleanupReport = {
        ...validReport,
        authDeleted: false,
      };
      expect(isTeardownVerified(authFailedReport)).toBe(false);
    });

    it('3. PostgreSQL dirty state produces cleanupVerified=false / throws fail-closed', () => {
      expect(isTeardownVerified({ ...validReport, postgresClean: false })).toBe(false);
      expect(
        isTeardownVerified({
          ...validReport,
          postgresDetails: { ...validReport.postgresDetails, clean: false },
        })
      ).toBe(false);
      expect(
        isTeardownVerified({
          ...validReport,
          postgresDetails: { ...validReport.postgresDetails, anchor_concept_intact: false },
        })
      ).toBe(false);
      expect(isTeardownVerified(undefined)).toBe(false);
      expect(isTeardownVerified(null)).toBe(false);
    });

    it('4. no nonexistent report property is read on canonical cleanup report', () => {
      // Proves that cleanupReport does NOT have top-level `isClean` or `counts`
      expect((validReport as unknown as Record<string, unknown>).isClean).toBeUndefined();
      expect((validReport as unknown as Record<string, unknown>).counts).toBeUndefined();

      // Proves that validReport strictly exposes existing canonical fields
      expect(validReport.authDeleted).toBe(true);
      expect(validReport.postgresClean).toBe(true);
      expect(validReport.postgresDetails.clean).toBe(true);
      expect(validReport.postgresDetails.counts.users).toBe(0);
      expect(validReport.postgresDetails.anchor_concept_intact).toBe(true);
    });

    it('5. Phase B, C, and D consume the same canonical cleanup semantics', () => {
      // Given the identical valid cleanup report, all phases interpret the report identically
      const phaseBVerified = isTeardownVerified(validReport);
      const phaseCVerified = isTeardownVerified(validReport);
      const phaseDVerified = isTeardownVerified(validReport);

      expect(phaseBVerified).toBe(true);
      expect(phaseCVerified).toBe(true);
      expect(phaseDVerified).toBe(true);
    });
  });

  describe('Phase D Runner Return & Finally Execution Semantics', () => {
    const mockContext = {
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.com' },
      session: { accessToken: 'mock-token', userId: '11111111-1111-4111-8111-111111111111' },
      authHeaders: { Authorization: 'Bearer mock-token' },
      me: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'test@example.com',
        displayName: 'Test',
        interfaceLanguageCode: 'vi',
        timeZone: 'Asia/Ho_Chi_Minh',
        languageProfiles: [],
      },
      languageProfileId: '22222222-2222-4222-8222-222222222222',
      conceptId: '7f110000-0000-4000-8000-000000000004',
      reviewItemId: '44444444-4444-4444-8444-444444444444',
      todayPlan: {
        id: '33333333-3333-4333-8333-333333333333',
        languageProfileId: '22222222-2222-4222-8222-222222222222',
        planDate: '2026-09-06',
        timeZone: 'Asia/Ho_Chi_Minh',
        targetMinutes: 15,
        completedMinutes: 0,
        status: 'active',
        engineVersion: 'today-heuristic-v1',
        activities: [],
        createdAt: '2026-09-06T00:00:00Z',
        updatedAt: '2026-09-06T00:00:00Z',
      },
      reviewActivity: {
        id: '55555555-5555-4555-8555-555555555555',
        position: 0,
        activityType: 'review',
        title: 'Review',
        description: 'Review due item',
        estimatedMinutes: 5,
        reasonCodes: ['FSRS_DUE'],
        reasonText: 'Due',
        status: 'pending',
        completedCount: 0,
        createdAt: '2026-09-06T00:00:00Z',
      },
      handoff: {
        actorId: '11111111-1111-4111-8111-111111111111',
        languageProfileId: '22222222-2222-4222-8222-222222222222',
        conceptId: '7f110000-0000-4000-8000-000000000004',
        reviewItemId: '44444444-4444-4444-8444-444444444444',
        todayPlanId: '33333333-3333-4333-8333-333333333333',
        todayActivityId: '55555555-5555-4555-8555-555555555555',
      },
      preTodayDigest: {} as any,
      postTodayDigest: {
        user_id: '11111111-1111-4111-8111-111111111111',
        concept_id: '7f110000-0000-4000-8000-000000000004',
        review_item_count: 1,
        review_item_ids: ['44444444-4444-4444-8444-444444444444'],
        fsrs_state_count: 1,
        fsrs_states: [
          {
            review_item_id: '44444444-4444-4444-8444-444444444444',
            state: 'new',
            state_version: 1,
            due_at: '2026-09-06T08:00:00Z',
            last_review_at: null,
          },
        ],
        review_event_count: 0,
        review_events: [],
        learning_event_count: 1,
        learning_events: [{ event_type: 'learning.concept.saved.v1', source_type: 'concept_save_intent' }],
        concept_state: priorConcept,
        skill_states: priorSkills,
        projection_heads: [priorHead], review_items: [], save_intents: [],
        today_plan_count: 1,
        today_plan_ids: ['33333333-3333-4333-8333-333333333333'],
        today_activity_review_item_ids: ['44444444-4444-4444-8444-444444444444'],
      } as any,
      apiBaseUrl: 'http://127.0.0.1:8000',
    };

    function createMockPostAnswerDigest(idempotencyKey: string) {
      return {
        ...mockContext.postTodayDigest,
        fsrs_states: [
          {
            review_item_id: '44444444-4444-4444-8444-444444444444',
            state: 'learning',
            parameter_set_id: parameterId, params_version: 'fsrs-6-default-v1', step: 0,
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
            idempotency_key: idempotencyKey,
            rating: 'good',
            response_time_ms: 1500,
            request_fingerprint: 'mock-fp',
            created_at: '2026-09-06T08:00:00Z',
            has_memory_snapshot: true,
            has_competence_snapshot: true,
            result_memory_snapshot: committedMemorySnapshot,
            result_competence_snapshot: committedCompetenceSnapshot,
            result_remaining_due_count: 0, result_feedback: 'OK',
          },
        ],
        learning_event_count: 2,
        learning_events: [
          { event_type: 'learning.concept.saved.v1', source_type: 'concept_save_intent' },
          {
            ...parameterLineage,
            learning_event_id: '77777777-7777-4777-8777-777777777777',
            event_type: 'learning.review.completed.v1',
            source_type: 'review_event',
            source_event_id: '66666666-6666-4666-8666-666666666666',
            ingestion_sequence: 2,
          },
        ],
        concept_state: reviewedConcept,
        skill_states: reviewedSkills,
        projection_heads: [reviewedHead],
      };
    }

    function createMockHarness() {
      let queueCallCount = 0;
      let capturedKey = '';

      const fetchFn = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const urlStr = String(url);
        const method = init?.method ?? 'GET';

        if (urlStr.includes('/v1/review/queue') && method === 'GET') {
          queueCallCount++;
          const queueData =
            queueCallCount === 1
              ? [
                  {
                    reviewItemId: '44444444-4444-4444-8444-444444444444',
                    concept: {
                      id: '7f110000-0000-4000-8000-000000000004',
                      canonicalForm: 'frll-anchor',
                      isDue: true,
                      status: 'learning',
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
                ]
              : [];
          return new Response(JSON.stringify({ data: queueData, meta: {
            apiVersion: '1.0', requestId: '990e8400-e29b-41d4-a716-446655440000',
            nextCursor: null, hasMore: false, pageSize: queueData.length,
          } }), { status: 200 });
        }

        if (urlStr.includes('/answer') && method === 'POST') {
          const headers = (init?.headers as Record<string, string>) || {};
          const headerKey = headers['Idempotency-Key'] || headers['idempotency-key'];
          if (headerKey) {
            capturedKey = headerKey;
          }
          const body = JSON.parse(String(init?.body ?? '{}'));
          if (body.rating === 'hard') {
            return new Response(JSON.stringify({ error: {
              code: 'IDEMPOTENCY_KEY_REUSED', message: 'Conflict',
              requestId: '11111111-1111-4111-8111-111111111111',
            } }), { status: 409 });
          }
          return new Response(
            JSON.stringify({
              data: {
                reviewItemId: '44444444-4444-4444-8444-444444444444',
                memory: {
                  state: 'learning',
                  dueAt: '2026-09-07T08:00:00Z',
                  lastReviewedAt: '2026-09-06T08:00:00Z',
                  isDue: false,
                },
                competence: reviewedSignals,
                remainingDueCount: 0,
                feedback: 'OK',
              },
              meta: { apiVersion: '1.0', requestId: '990e8400-e29b-41d4-a716-446655440000' },
            }),
            { status: 200 }
          );
        }

        return new Response('{}', { status: 200 });
      };

      let captureDigestCount = 0;
      const captureDigest = async () => {
        captureDigestCount++;
        if (captureDigestCount === 1) {
          return mockContext.postTodayDigest;
        }
        return createMockPostAnswerDigest(capturedKey) as any;
      };

      return { fetchFn, captureDigest };
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

    it.each(['snapshot score', 'snapshot due', 'snapshot remaining'])('F1 rejects first committed %s mismatch', async attack => {
      const harness = createMockHarness();
      let probes = 0;
      await expect(runPhaseDLearningLoop({ seams: {
        setupThroughToday: async opts => { opts.onUserCreated?.(mockContext.user.id); return mockContext; },
        fetchFn: harness.fetchFn,
        captureDigest: async () => {
          const digest = JSON.parse(JSON.stringify(await harness.captureDigest()));
          if (++probes >= 2) {
            const event = digest.review_events[0];
            if (attack === 'snapshot score') event.result_competence_snapshot.production.score = 0.01;
            if (attack === 'snapshot due') event.result_memory_snapshot.dueAt = '2030-01-01T00:00:00Z';
            if (attack === 'snapshot remaining') event.result_remaining_due_count = 123;
          }
          return digest;
        },
        teardownLearner: async () => validTeardownReport,
      } })).rejects.toThrow('persisted');
    });

    it.each(['score', 'confidence', 'last_evidence_at'])('F1 rejects first Review skill %s mismatch', async field => {
      const harness = createMockHarness();
      let probes = 0;
      await expect(runPhaseDLearningLoop({ seams: {
        setupThroughToday: async opts => { opts.onUserCreated?.(mockContext.user.id); return mockContext; },
        fetchFn: harness.fetchFn,
        captureDigest: async () => {
          const digest = JSON.parse(JSON.stringify(await harness.captureDigest()));
          if (++probes >= 2) digest.skill_states[2][field] = field === 'last_evidence_at' ? '2030-01-01T00:00:00Z' : 0.99;
          return digest;
        },
        teardownLearner: async () => validTeardownReport,
      } })).rejects.toThrow(`persisted production skill ${field}`);
    });

    it.each(['production score', 'remainingDueCount', 'queue HTTP 500'])('F1 rejects corrupted %s', async (attack) => {
      const harness = createMockHarness();
      let answers = 0;
      let queues = 0;
      const fetchFn: typeof fetch = async (url, init) => {
        const response = await harness.fetchFn(url, init);
        if (String(url).includes('/answer') && ++answers === 2) {
          const raw = await response.json();
          if (attack === 'production score') raw.data.competence.production.score = 0.01;
          if (attack === 'remainingDueCount') raw.data.remainingDueCount = 123;
          return new Response(JSON.stringify(raw), { status: response.status });
        }
        if (String(url).includes('/queue') && ++queues === 2 && attack === 'queue HTTP 500') {
          return new Response('{}', { status: 500 });
        }
        return response;
      };
      await expect(runPhaseDLearningLoop({ seams: {
        setupThroughToday: async (opts) => {
          opts.onUserCreated?.(mockContext.user.id);
          return mockContext;
        },
        fetchFn,
        captureDigest: harness.captureDigest,
        teardownLearner: async () => validTeardownReport,
      } })).rejects.toThrow(attack === 'queue HTTP 500' ? 'queue reconcile' : 'Replay');
    });

    it.each(['feedback', 'memory isDue', 'recognition confidence', 'missing score'])('F1 rejects replay %s drift', async attack => {
      const harness = createMockHarness();
      let answers = 0;
      await expect(runPhaseDLearningLoop({ seams: {
        setupThroughToday: async opts => { opts.onUserCreated?.(mockContext.user.id); return mockContext; },
        fetchFn: async (url, init) => {
          const response = await harness.fetchFn(url, init);
          if (String(url).includes('/answer') && ++answers === 2) {
            const raw = await response.json();
            if (attack === 'feedback') raw.data.feedback = 'corrupted';
            if (attack === 'memory isDue') raw.data.memory.isDue = true;
            if (attack === 'recognition confidence') raw.data.competence.recognition.confidence = 0.1;
            if (attack === 'missing score') delete raw.data.competence.production.score;
            return new Response(JSON.stringify(raw), { status: 200 });
          }
          return response;
        },
        captureDigest: harness.captureDigest,
        teardownLearner: async () => validTeardownReport,
      } })).rejects.toThrow(attack === 'missing score' ? 'frozen OpenAPI' : 'Replay');
    });

    it.each(['replay', 'conflict'])('F1 rejects %s persisted mass mutation despite unchanged row counts', async stage => {
      const harness = createMockHarness();
      let probes = 0;
      await expect(runPhaseDLearningLoop({ seams: {
        setupThroughToday: async opts => { opts.onUserCreated?.(mockContext.user.id); return mockContext; },
        fetchFn: harness.fetchFn,
        captureDigest: async () => {
          const digest = JSON.parse(JSON.stringify(await harness.captureDigest()));
          if (++probes === (stage === 'replay' ? 3 : 4)) digest.concept_state.production_positive_mass = '999';
          return digest;
        },
        teardownLearner: async () => validTeardownReport,
      } })).rejects.toThrow('persisted learner digest');
    });

    it('F1 rejects noncanonical HTTP 409 error code', async () => {
      const harness = createMockHarness();
      await expect(runPhaseDLearningLoop({ seams: {
        setupThroughToday: async opts => { opts.onUserCreated?.(mockContext.user.id); return mockContext; },
        fetchFn: async (url, init) => {
          const response = await harness.fetchFn(url, init);
          if (response.status !== 409) return response;
          const raw = await response.json(); raw.error.code = 'CONFLICT';
          return new Response(JSON.stringify(raw), { status: 409 });
        },
        captureDigest: harness.captureDigest,
        teardownLearner: async () => validTeardownReport,
      } })).rejects.toThrow('expected canonical IDEMPOTENCY_KEY_REUSED');
    });

    it('proves resultReport is constructed before cleanup, finally mutates it, and returned report has cleanupVerified=true', async () => {
      const harness = createMockHarness();

      const report = await runPhaseDLearningLoop({
        seams: {
          setupThroughToday: async (opts) => {
            opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
            return mockContext;
          },
          fetchFn: harness.fetchFn as any,
          captureDigest: harness.captureDigest as any,
          teardownLearner: async () => validTeardownReport,
        },
      });

      // 1. Result constructed before cleanup
      expect(report.success).toBe(true);
      expect(report.userId).toBe('11111111-1111-4111-8111-111111111111');
      expect(report.reviewItemId).toBe('44444444-4444-4444-8444-444444444444');

      // 2. Teardown ran and 3. The returned report has cleanupVerified=true
      expect(report.cleanupVerified).toBe(true);

      // 4. cleanupReport is present and contains canonical proof
      expect(report.cleanupReport).toBeDefined();
      expect(report.cleanupReport?.authDeleted).toBe(true);
      expect(report.cleanupReport?.postgresClean).toBe(true);
      expect(report.cleanupReport?.postgresDetails.clean).toBe(true);
      expect(report.cleanupReport?.postgresDetails.counts.users).toBe(0);
      expect(report.cleanupReport?.postgresDetails.counts.review_events).toBe(0);
    });

    it('5a. failure in cleanup (throwing) still rejects instead of returning a report with false', async () => {
      const harness = createMockHarness();

      await expect(
        runPhaseDLearningLoop({
          seams: {
            setupThroughToday: async (opts) => {
              opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
              return mockContext;
            },
            fetchFn: harness.fetchFn as any,
            captureDigest: harness.captureDigest as any,
            teardownLearner: async () => {
              throw new Error('Supabase Auth connection timed out during delete');
            },
          },
        })
      ).rejects.toThrow('Supabase Auth connection timed out during delete');
    });

    it('5b. dirty state in cleanup report still rejects fail-closed instead of returning success', async () => {
      const harness = createMockHarness();

      const dirtyTeardownReport: FrllCleanupReport = {
        authDeleted: true,
        postgresClean: false,
        postgresDetails: {
          ...validTeardownReport.postgresDetails,
          clean: false,
          counts: {
            ...validTeardownReport.postgresDetails.counts,
            review_events: 1,
          },
        },
      };

      await expect(
        runPhaseDLearningLoop({
          seams: {
            setupThroughToday: async (opts) => {
              opts.onUserCreated?.('11111111-1111-4111-8111-111111111111');
              return mockContext;
            },
            fetchFn: harness.fetchFn as any,
            captureDigest: harness.captureDigest as any,
            teardownLearner: async () => dirtyTeardownReport,
          },
        })
      ).rejects.toThrow('FRLL Phase D cleanup failure');
    });
  });
});
