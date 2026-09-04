/**
 * Legacy UI scenario harness for frozen component/integration tests.
 * This is deliberately not an ApiClient transport. Contract-valid transport fixtures and the
 * real MockApiClient live in @lingua/types; this helper only drives local presentation scenarios.
 */

import {
  type Concept,
  type ReviewItem,
  type ReviewRating,
  type ReaderContent,
  type BrainGraphData,
  type TodayPlan,
  type ProgressSummary,
  type DictionaryEntry,
  type UserSettings,
  type UserProfile,
  type ApiErrorResponse,
  type ErrorCode,
} from './types';
import {
  mockConcepts,
  mockReviewQueue,
  mockReaderContent,
  mockBrainGraphData,
  mockTodayPlan,
  mockProgressSummary,
  mockDictionaryEntry,
  mockUserSettings,
  mockUserProfile,
  mockSemanticErrors,
} from './contract-fixtures';

export class MockApiService {
  private concepts: Map<string, Concept> = new Map();
  private reviewQueue: ReviewItem[] = [];
  private readerContents: Map<string, ReaderContent> = new Map();
  private todayPlan: TodayPlan;
  private progressSummary: ProgressSummary;
  private userSettings: UserSettings;
  private userProfile: UserProfile;

  private injectedError: ApiErrorResponse | null = null;
  private latencyMs: number = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.concepts.clear();
    mockConcepts.forEach((c) => this.concepts.set(c.id, JSON.parse(JSON.stringify(c))));
    this.reviewQueue = JSON.parse(JSON.stringify(mockReviewQueue));
    this.readerContents.clear();
    this.readerContents.set(mockReaderContent.id, JSON.parse(JSON.stringify(mockReaderContent)));
    this.todayPlan = JSON.parse(JSON.stringify(mockTodayPlan));
    this.progressSummary = JSON.parse(JSON.stringify(mockProgressSummary));
    this.userSettings = JSON.parse(JSON.stringify(mockUserSettings));
    this.userProfile = JSON.parse(JSON.stringify(mockUserProfile));
    this.injectedError = null;
    this.latencyMs = 0;
  }

  public injectError(code: ErrorCode): void {
    this.injectedError = mockSemanticErrors[code] || {
      code,
      message: `Simulated error ${code}`,
      request_id: 'req-simulated',
    };
  }

  public clearInjectedError(): void {
    this.injectedError = null;
  }

  public setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  private async checkErrorOrDelay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    if (this.injectedError) {
      const err = new Error(this.injectedError.message) as Error & { status: number; errorResponse: ApiErrorResponse };
      err.errorResponse = this.injectedError;
      const statusMap: Record<ErrorCode, number> = {
        UNAUTHENTICATED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        VALIDATION_ERROR: 422,
        CONFLICT: 409,
        INTERNAL_ERROR: 500,
      };
      err.status = statusMap[this.injectedError.code] || 500;
      throw err;
    }
  }

  // --- Concept APIs ---
  public async getConcepts(): Promise<Concept[]> {
    await this.checkErrorOrDelay();
    return Array.from(this.concepts.values());
  }

  public async getConceptById(id: string): Promise<Concept | null> {
    await this.checkErrorOrDelay();
    return this.concepts.get(id) || null;
  }

  public async getConceptByTerm(term: string): Promise<Concept | null> {
    await this.checkErrorOrDelay();
    const normalized = term.toLowerCase().trim();
    for (const c of this.concepts.values()) {
      if (c.term.toLowerCase() === normalized || c.lemma.toLowerCase() === normalized) {
        return c;
      }
    }
    return null;
  }

  public async saveConcept(concept: Partial<Concept> & { term: string; cefr_level: any }): Promise<Concept> {
    await this.checkErrorOrDelay();
    const id = concept.id || `concept-${Date.now()}`;
    const newConcept: Concept = {
      id,
      term: concept.term,
      lemma: concept.lemma || concept.term.toLowerCase(),
      language: 'en',
      pos: concept.pos || 'noun',
      ipa: concept.ipa || '',
      translation_vi: concept.translation_vi || '',
      definition: concept.definition || '',
      cefr_level: concept.cefr_level || 'A2',
      status: concept.status || 'discovered',
      ...concept,
    };
    this.concepts.set(id, newConcept);
    return newConcept;
  }

  // --- Smart Review APIs (Deterministic Fixture Transition) ---
  public async getReviewQueue(): Promise<ReviewItem[]> {
    await this.checkErrorOrDelay();
    return [...this.reviewQueue];
  }

  public async submitReviewRating(itemId: string, rating: ReviewRating): Promise<{
    updatedItem: ReviewItem;
    updatedConcept: Concept | null;
    remainingQueueCount: number;
  }> {
    await this.checkErrorOrDelay();
    const itemIndex = this.reviewQueue.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Review item ${itemId} not found in active queue`);
    }

    const item = this.reviewQueue[itemIndex];
    const concept = this.concepts.get(item.concept_id);
    void rating;

    // Remove from active queue
    this.reviewQueue.splice(itemIndex, 1);
    return {
      updatedItem: item,
      updatedConcept: concept ? { ...concept } : null,
      remainingQueueCount: this.reviewQueue.length,
    };
  }

  // --- Reader APIs ---
  public async getReaderContent(contentId?: string): Promise<ReaderContent> {
    await this.checkErrorOrDelay();
    const id = contentId || mockReaderContent.id;
    const content = this.readerContents.get(id);
    if (!content) {
      throw new Error(`Reader content ${id} not found`);
    }
    return content;
  }

  // --- Language Brain APIs ---
  public async getBrainGraphData(): Promise<BrainGraphData> {
    await this.checkErrorOrDelay();
    return JSON.parse(JSON.stringify(mockBrainGraphData));
  }

  // --- Today Dashboard APIs ---
  public async getTodayPlan(): Promise<TodayPlan> {
    await this.checkErrorOrDelay();
    return JSON.parse(JSON.stringify(this.todayPlan));
  }

  // --- Progress APIs ---
  public async getProgressSummary(): Promise<ProgressSummary> {
    await this.checkErrorOrDelay();
    return { ...this.progressSummary };
  }

  // --- Dictionary APIs ---
  public async searchDictionary(query: string): Promise<DictionaryEntry[]> {
    await this.checkErrorOrDelay();
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const matches: DictionaryEntry[] = [];
    for (const c of this.concepts.values()) {
      if (c.term.toLowerCase().includes(q) || c.lemma.toLowerCase().includes(q)) {
        matches.push({
          term: c.term,
          lemma: c.lemma,
          pos: c.pos || 'noun',
          ipa: c.ipa || '',
          status: c.status,
          cefr_level: c.cefr_level,
          definitions: [
            {
              meaning_vi: c.translation_vi,
              explanation_en: c.definition,
              examples: c.examples || [],
            },
          ],
        });
      }
    }
    return matches;
  }

  // --- Local-only settings scenario and profile fixture ---
  public async getLocalSettings(): Promise<UserSettings> {
    await this.checkErrorOrDelay();
    return { ...this.userSettings };
  }

  public async updateLocalSettings(newSettings: Partial<UserSettings>): Promise<UserSettings> {
    await this.checkErrorOrDelay();
    this.userSettings = { ...this.userSettings, ...newSettings };
    return { ...this.userSettings };
  }

  public async getUserProfile(): Promise<UserProfile> {
    await this.checkErrorOrDelay();
    return {
      ...this.userProfile,
      total_concepts_encountered: this.userProfile.total_concepts_encountered,
      total_concepts_mastered: this.userProfile.total_concepts_mastered,
    };
  }
}

export const defaultMockApiService = new MockApiService();
