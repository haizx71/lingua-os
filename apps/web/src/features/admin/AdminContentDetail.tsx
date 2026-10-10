'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, InlineAlert, LoadingState } from '@lingua/ui';
import { mapApiErrorToUi, type ApiClient } from '@lingua/types';
import { getApiClient } from '../../lib/api/client';
import {
  getAdminContent,
  putAdminVietnameseTranslations,
  publishAdminContent,
  retireAdminContent,
  validateAdminContent,
  type AdminContentViewModel,
  type AdminValidationViewModel,
} from './adapters';
import { AdminSentenceConceptEditor } from './AdminSentenceConceptEditor';
import { AdminVietnameseTranslationEditor } from './AdminVietnameseTranslationEditor';

export function AdminContentDetail({ contentId, apiClient = getApiClient() }: { contentId: string; apiClient?: ApiClient }) {
  const [content, setContent] = useState<AdminContentViewModel | null>(null);
  const [validation, setValidation] = useState<AdminValidationViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setContent(await getAdminContent(apiClient, contentId)); }
    catch (reason) { setError(mapApiErrorToUi(reason).message); }
  }, [apiClient, contentId]);
  useEffect(() => { void load(); }, [load]);

  async function action(work: () => Promise<AdminContentViewModel>, invalidateValidation = false) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      setContent(await work());
      if (invalidateValidation) setValidation(null);
    }
    catch (reason) { setError(mapApiErrorToUi(reason).message); }
    finally { setBusy(false); }
  }
  async function validate() {
    if (busy) return;
    setBusy(true); setError(null);
    try { const result = await validateAdminContent(apiClient, contentId); setValidation(result); setContent(result.content); }
    catch (reason) { setError(mapApiErrorToUi(reason).message); }
    finally { setBusy(false); }
  }

  if (!content && !error) return <LoadingState message="Đang tải bản thảo..." count={2} />;
  if (!content) return <InlineAlert variant="danger" title="Không thể tải nội dung">{error}</InlineAlert>;
  const statusLabel = ({
    draft: 'Bản nháp',
    normalized: 'Đã chuẩn hóa',
    reviewed: 'Đã kiểm tra',
    published: 'Đã phát hành',
    retired: 'Đã ngừng phát hành',
  } as Record<string, string>)[content.status] ?? 'Trạng thái khác';
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <header className="flex min-w-0 flex-col gap-3 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-lilac)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0"><p className="lingua-kicker text-[var(--action-primary)]">{content.level} · Nội dung</p><h1 className="mt-1 break-words text-2xl font-bold tracking-[-0.035em] text-[var(--text-primary)] sm:text-3xl">{content.title}</h1></div>
        <Badge variant={content.status === 'published' ? 'success' : content.status === 'reviewed' ? 'primary' : 'neutral'} size="md">{statusLabel}</Badge>
      </header>
      {error && <InlineAlert variant="danger" title="Thao tác không thành công">{error}</InlineAlert>}
      {validation && !validation.isValid && <InlineAlert variant="danger" title="Chưa thể xuất bản"><ul className="list-disc pl-5">{validation.issues.map((issue) => <li key={`${issue.field}:${issue.reason}`}>{issue.reason}</li>)}</ul></InlineAlert>}
      {validation?.isValid && <InlineAlert variant="success" title="Đã kiểm tra">Nội dung đáp ứng yêu cầu phát hành hiện tại.</InlineAlert>}
      <Card padding="md" className="space-y-2"><h2 className="font-semibold text-[var(--text-primary)]">Nguồn và quyền sử dụng</h2><p className="text-sm text-[var(--text-primary)]">{content.authorName} · {content.sourceName} · {content.sourceVersion}</p><p className="text-sm leading-6 text-[var(--text-secondary)]">{content.attributionText}</p><p className="text-sm leading-6 text-[var(--text-secondary)]">{content.rightsStatement}</p><p className="break-all font-mono text-[11px] text-[var(--text-muted)]">SHA-256: {content.rawHash}</p></Card>
      <AdminVietnameseTranslationEditor
        content={content}
        busy={busy}
        readOnly={content.status === 'published' || content.status === 'retired'}
        onSave={(body) => { void action(() => putAdminVietnameseTranslations(apiClient, contentId, body), true); }}
        onClear={() => { void action(() => putAdminVietnameseTranslations(apiClient, contentId, { entries: [] }), true); }}
      />
      <section className="space-y-3">
        <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Khái niệm trong câu</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {content.sentences.filter((sentence) => sentence.conceptCount > 0).length}/{content.sentences.length} câu đã sẵn sàng
          </p>
        </div>
        {content.sentences.map((sentence) => (
          <AdminSentenceConceptEditor
            key={sentence.id}
            apiClient={apiClient}
            content={content}
            sentence={sentence}
            onContent={(value) => { setContent(value); setValidation(null); }}
          />
        ))}
      </section>
      <div className="flex flex-wrap gap-3">
        {!['published','retired'].includes(content.status) && <Button variant="outline" disabled={busy} onClick={() => void validate()}>Kiểm tra</Button>}
        {content.status === 'reviewed' && <Button disabled={busy} onClick={() => void action(() => publishAdminContent(apiClient, contentId))}>Xuất bản</Button>}
        {content.status === 'published' && <Button variant="outline" disabled={busy} onClick={() => void action(() => retireAdminContent(apiClient, contentId))}>Ngừng phát hành</Button>}
      </div>
    </div>
  );
}
