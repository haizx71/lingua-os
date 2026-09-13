'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, InlineAlert } from '@lingua/ui';
import { mapApiErrorToUi, type ApiClient } from '@lingua/types';
import { getApiClient } from '../../lib/api/client';
import { createAdminContent, type AdminContentFormValues } from './adapters';

const initial: AdminContentFormValues = {
  title: '',
  body: '',
  languageCode: 'en',
  level: 'A1',
  authorName: '',
  sourceName: 'LINGUA OS original articles',
  sourceVersion: 'v1',
  attributionText: '',
  rightsStatement: '',
};

export function AdminContentForm({ apiClient = getApiClient() }: { apiClient?: ApiClient }) {
  const router = useRouter();
  return <AdminContentFormView apiClient={apiClient} onCreated={(id) => router.push(`/admin/content/${id}`)} />;
}

export function AdminContentFormView({
  apiClient,
  onCreated,
}: {
  apiClient: ApiClient;
  onCreated(id: string): void;
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (name: keyof AdminContentFormValues, value: string) => setValues((old) => ({ ...old, [name]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const content = await createAdminContent(apiClient, values);
      onCreated(content.id);
    } catch (reason) {
      setError(mapApiErrorToUi(reason).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header><h1 className="text-2xl font-bold text-[var(--text-primary)]">Nội dung mới</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Micro-article tiếng Anh, nguồn sở hữu trực tiếp.</p></header>
      {error && <InlineAlert variant="danger" title="Không thể lưu">{error}</InlineAlert>}
      <Card className="p-5">
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Tiêu đề"><input required maxLength={500} value={values.title} onChange={(e) => set('title', e.target.value)} className={inputClass} /></Field>
          <Field label="Mức nội dung"><select value={values.level} onChange={(e) => set('level', e.target.value)} className={inputClass}>{['A0','A1','A2','B1'].map((level) => <option key={level}>{level}</option>)}</select></Field>
          <Field label="Nội dung tiếng Anh"><textarea required rows={12} maxLength={100000} value={values.body} onChange={(e) => set('body', e.target.value)} className={inputClass} /></Field>
          <Field label="Tác giả"><input required maxLength={200} value={values.authorName} onChange={(e) => set('authorName', e.target.value)} className={inputClass} /></Field>
          <Field label="Tên nguồn"><input required maxLength={200} value={values.sourceName} onChange={(e) => set('sourceName', e.target.value)} className={inputClass} /></Field>
          <Field label="Phiên bản nguồn"><input required maxLength={100} value={values.sourceVersion} onChange={(e) => set('sourceVersion', e.target.value)} className={inputClass} /></Field>
          <Field label="Ghi công"><textarea required rows={2} maxLength={1000} value={values.attributionText} onChange={(e) => set('attributionText', e.target.value)} className={inputClass} /></Field>
          <Field label="Xác nhận quyền sử dụng"><textarea required rows={2} maxLength={1000} value={values.rightsStatement} onChange={(e) => set('rightsStatement', e.target.value)} className={inputClass} /></Field>
          <Button type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu nội dung'}</Button>
        </form>
      </Card>
    </div>
  );
}

const inputClass = 'mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-[var(--text-primary)]">{label}{children}</label>;
}
