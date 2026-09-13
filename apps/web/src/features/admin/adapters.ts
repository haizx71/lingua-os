import type {
  AdminContentDto,
  AdminContentValidationDto,
  ApiClient,
  CreateAdminContentRequestDto,
  UpdateAdminContentRequestDto,
} from '@lingua/types';

export interface AdminSentenceViewModel {
  readonly id: string;
  readonly order: number;
  readonly text: string;
  readonly conceptCount: number;
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
    sentences: value.sentences.map((sentence) => ({ ...sentence })),
    publishedAt: value.publishedAt ?? null,
    updatedAt: value.updatedAt,
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
