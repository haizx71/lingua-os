import type {
  AdminContentDto,
  AdminContentValidationDto,
  AdminCatalogConceptDto,
  AdminVietnameseTranslationSourceDto,
  ApiClient,
  CreateAdminContentRequestDto,
  UpdateAdminContentRequestDto,
  PutAdminSentenceConceptRequestDto,
  PutAdminVietnameseTranslationsRequestDto,
} from '@lingua/types';

export interface AdminSentenceViewModel {
  readonly id: string;
  readonly order: number;
  readonly text: string;
  readonly translationVi: string | null;
  readonly conceptCount: number;
  readonly concepts: readonly AdminSentenceConceptViewModel[];
}

export interface AdminCatalogConceptViewModel {
  readonly id: string;
  readonly conceptType: 'word' | 'phrase' | 'grammar' | 'skill';
  readonly canonicalForm: string;
  readonly partOfSpeech: string | null;
  readonly definition: string | null;
}

export interface AdminSentenceConceptViewModel {
  readonly concept: AdminCatalogConceptViewModel;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly occurrenceRole: 'target' | 'context' | 'grammar';
  readonly surfaceText: string;
}

export interface AdminContentViewModel {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly level: 'A0' | 'A1' | 'A2' | 'B1';
  readonly status: string;
  readonly authorName: string;
  readonly sourceName: string;
  readonly sourceVersion: string;
  readonly licenseCode: string;
  readonly attributionText: string;
  readonly rightsStatement: string;
  readonly rawHash: string;
  readonly translationSource: AdminVietnameseTranslationSourceDto | null;
  readonly sentences: readonly AdminSentenceViewModel[];
  readonly publishedAt: string | null;
  readonly updatedAt: string;
}

export interface AdminValidationViewModel {
  readonly content: AdminContentViewModel;
  readonly isValid: boolean;
  readonly issues: readonly { field: string; reason: string }[];
}

export type AdminContentFormValues = CreateAdminContentRequestDto;

export function toAdminContentViewModel(value: AdminContentDto): AdminContentViewModel {
  return {
    id: value.id,
    title: value.title,
    body: value.body,
    level: value.level,
    status: value.status,
    authorName: value.authorName,
    sourceName: value.sourceName,
    sourceVersion: value.sourceVersion,
    licenseCode: value.licenseCode,
    attributionText: value.attributionText,
    rightsStatement: value.rightsStatement,
    rawHash: value.rawHash,
    translationSource: value.translationSource,
    sentences: value.sentences.map((sentence) => ({
      ...sentence,
      concepts: sentence.concepts.map((occurrence) => ({
        ...occurrence,
        concept: toAdminCatalogConceptViewModel(occurrence.concept),
      })),
    })),
    publishedAt: value.publishedAt ?? null,
    updatedAt: value.updatedAt,
  };
}

export function toAdminCatalogConceptViewModel(
  value: AdminCatalogConceptDto,
): AdminCatalogConceptViewModel {
  return {
    id: value.id,
    conceptType: value.conceptType,
    canonicalForm: value.canonicalForm,
    partOfSpeech: value.partOfSpeech,
    definition: value.definition,
  };
}

export function toAdminValidationViewModel(value: AdminContentValidationDto): AdminValidationViewModel {
  return {
    content: toAdminContentViewModel(value.content),
    isValid: value.isValid,
    issues: value.issues.map((issue) => ({ ...issue })),
  };
}

export async function listAdminContent(client: ApiClient): Promise<readonly AdminContentViewModel[]> {
  return (await client.listAdminContent()).data.map(toAdminContentViewModel);
}

export async function createAdminContent(
  client: ApiClient,
  values: AdminContentFormValues,
): Promise<AdminContentViewModel> {
  return toAdminContentViewModel((await client.createAdminContent(values)).data);
}

export async function getAdminContent(
  client: ApiClient,
  contentId: string,
): Promise<AdminContentViewModel> {
  return toAdminContentViewModel((await client.getAdminContent(contentId)).data);
}

export async function updateAdminContent(
  client: ApiClient,
  contentId: string,
  values: UpdateAdminContentRequestDto,
): Promise<AdminContentViewModel> {
  return toAdminContentViewModel((await client.updateAdminContent({ contentId, body: values })).data);
}

export async function putAdminVietnameseTranslations(
  client: ApiClient,
  contentId: string,
  body: PutAdminVietnameseTranslationsRequestDto,
): Promise<AdminContentViewModel> {
  return toAdminContentViewModel(
    (await client.putAdminVietnameseTranslations({ contentId, body })).data,
  );
}

export async function validateAdminContent(
  client: ApiClient,
  contentId: string,
): Promise<AdminValidationViewModel> {
  return toAdminValidationViewModel((await client.validateAdminContent(contentId)).data);
}

export async function publishAdminContent(client: ApiClient, contentId: string) {
  return toAdminContentViewModel((await client.publishAdminContent(contentId)).data);
}

export async function retireAdminContent(client: ApiClient, contentId: string) {
  return toAdminContentViewModel((await client.retireAdminContent(contentId)).data);
}

export async function searchAdminConcepts(
  client: ApiClient,
  query: string,
): Promise<readonly AdminCatalogConceptViewModel[]> {
  return (await client.searchAdminConcepts({ query })).data.map(toAdminCatalogConceptViewModel);
}

export async function putAdminSentenceConcept(
  client: ApiClient,
  input: {
    contentId: string;
    sentenceId: string;
    conceptId: string;
    body: PutAdminSentenceConceptRequestDto;
  },
): Promise<AdminContentViewModel> {
  return toAdminContentViewModel((await client.putAdminSentenceConcept(input)).data);
}

export async function deleteAdminSentenceConcept(
  client: ApiClient,
  input: {
    contentId: string;
    sentenceId: string;
    conceptId: string;
    startOffset: number;
    endOffset: number;
  },
): Promise<AdminContentViewModel> {
  const { startOffset, endOffset, ...identity } = input;
  return toAdminContentViewModel((await client.deleteAdminSentenceConcept({
    ...identity,
    query: { startOffset, endOffset },
  })).data);
}
