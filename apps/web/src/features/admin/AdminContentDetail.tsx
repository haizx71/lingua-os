'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, InlineAlert, LoadingState } from '@lingua/ui';
import { mapApiErrorToUi, type ApiClient } from '@lingua/types';
import { getApiClient } from '../../lib/api/client';
import {
  getAdminContent,
  publishAdminContent,
  retireAdminContent,
  validateAdminContent,
  type AdminContentViewModel,
  type AdminValidationViewModel,
} from './adapters';
import { AdminSentenceConceptEditor } from './AdminSentenceConceptEditor';

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

  async function action(work: () => Promise<AdminContentViewModel>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { setContent(await work()); }
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
  return (
    <div className="max-w-4xl space-y-5">
      <header><p className="text-sm text-[var(--text-secondary)]">{content.level} · {content.status}</p><h1 className="text-2xl font-bold text-[var(--text-primary)]">{content.title}</h1></header>
      {error && <InlineAlert variant="danger" title="Thao tác không thành công">{error}</InlineAlert>}
      {validation && !validation.isValid && <InlineAlert variant="danger" title="Chưa thể xuất bản"><ul className="list-disc pl-5">{validation.issues.map((issue) => <li key={`${issue.field}:${issue.reason}`}>{issue.reason}</li>)}</ul></InlineAlert>}
      {validation?.isValid && <InlineAlert variant="success" title="Đã kiểm tra">Nội dung đáp ứng publication gate hiện tại.</InlineAlert>}
      <Card className="p-5 space-y-2"><h2 className="font-semibold">Nguồn và quyền</h2><p>{content.authorName} · {content.sourceName} · {content.sourceVersion}</p><p className="text-sm text-[var(--text-secondary)]">{content.attributionText}</p><p className="text-sm text-[var(--text-secondary)]">{content.rightsStatement}</p><p className="break-all font-mono text-xs text-[var(--text-muted)]">SHA-256: {content.rawHash}</p></Card>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Ánh xạ concept theo câu</h2>
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
