'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card, InlineAlert } from '@lingua/ui';
import type { PutAdminVietnameseTranslationsRequestDto } from '@lingua/types';
import type { AdminContentViewModel } from './adapters';

type TranslationEntry = {
  ordinal: number;
  sourceText: string;
  translationText: string;
};

type TranslationSource = {
  authorName: string;
  sourceName: string;
  sourceVersion: string;
  attributionText: string;
  rightsStatement: string;
};

const emptySource: TranslationSource = {
  authorName: '',
  sourceName: '',
  sourceVersion: '',
  attributionText: '',
  rightsStatement: '',
};

export function AdminVietnameseTranslationEditor({
  content,
  busy,
  onSave,
  onClear,
  readOnly = false,
}: {
  content: AdminContentViewModel;
  busy: boolean;
  onSave(body: PutAdminVietnameseTranslationsRequestDto): void;
  onClear(): void;
  readOnly?: boolean;
}) {
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<readonly TranslationEntry[] | null>(null);
  const [importErrors, setImportErrors] = useState<readonly string[]>([]);
  const [source, setSource] = useState<TranslationSource>(emptySource);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const currentSource = content.translationSource;
    setSource(
      currentSource
        ? {
            authorName: currentSource.authorName,
            sourceName: currentSource.sourceName,
            sourceVersion: currentSource.sourceVersion,
            attributionText: currentSource.attributionText,
            rightsStatement: currentSource.rightsStatement,
          }
        : emptySource,
    );
    const currentEntries = content.sentences.map((sentence, index) => ({
      ordinal: index + 1,
      sourceText: sentence.text,
      translationText: sentence.translationVi ?? '',
    }));
    if (currentSource && currentEntries.every((entry) => entry.translationText.trim())) {
      setPreview(currentEntries);
      setImportErrors([]);
    } else {
      setPreview(null);
    }
    setConfirmClear(false);
  }, [content]);

  if (readOnly) {
    return (
      <Card padding="md" className="space-y-3">
        <div>
          <p className="lingua-kicker text-[var(--action-primary)]">Bản dịch tiếng Việt</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Bản dịch đã lưu</h2>
        </div>
        {content.sentences.map((sentence) => (
          <div key={sentence.id} className="grid gap-1 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-2">
            <p className="text-sm leading-6 text-[var(--text-primary)]">{sentence.text}</p>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{sentence.translationVi ?? 'Chưa có bản dịch.'}</p>
          </div>
        ))}
      </Card>
    );
  }

  function previewImport() {
    setPreview(null);
    setImportErrors([]);
    let imported: unknown;
    try {
      imported = JSON.parse(importText);
    } catch {
      setImportErrors(['Không đọc được JSON. Hãy kiểm tra lại nội dung đã dán.']);
      return;
    }
    const rows = readRows(imported);
    if (!rows) {
      setImportErrors(['JSON cần có danh sách câu trong trường “sentences” hoặc “entries”.']);
      return;
    }
    const errors: string[] = [];
    if (rows.length !== content.sentences.length) {
      errors.push(`Cần đúng ${content.sentences.length} cặp câu; hiện có ${rows.length}.`);
    }
    const entries: TranslationEntry[] = [];
    const rowCount = Math.min(rows.length, content.sentences.length);
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows[index];
      const expected = content.sentences[index];
      const ordinal = row.ordinal;
      const sourceText = typeof row.english === 'string' ? row.english : row.sourceText;
      const translationText = typeof row.vietnamese === 'string' ? row.vietnamese : row.translationText;
      if (ordinal !== index + 1) {
        errors.push(`Cặp ${index + 1}: thứ tự phải là ${index + 1}.`);
      }
      if (sourceText !== expected.text) {
        errors.push(`Cặp ${index + 1}: câu tiếng Anh không khớp bản xem trước từ máy chủ.`);
      }
      if (typeof translationText !== 'string' || !translationText.trim()) {
        errors.push(`Cặp ${index + 1}: bản dịch tiếng Việt đang trống.`);
      }
      if (sourceText === expected.text && typeof translationText === 'string' && translationText.trim()) {
        entries.push({ ordinal: index + 1, sourceText, translationText });
      }
    }
    if (errors.length > 0 || entries.length !== content.sentences.length) {
      setImportErrors(errors.length ? errors : ['Chưa có đủ cặp câu khớp với nội dung hiện tại.']);
      return;
    }
    setPreview(entries);
  }

  function updateSource(field: keyof TranslationSource, value: string) {
    setSource((current) => ({ ...current, [field]: value }));
  }

  function save() {
    if (!preview || !hasCompleteSource(source) || busy) return;
    onSave({
      entries: preview,
      source: {
        authorName: source.authorName,
        sourceName: source.sourceName,
        sourceVersion: source.sourceVersion,
        attributionText: source.attributionText,
        rightsStatement: source.rightsStatement,
      },
    });
  }

  return (
    <Card padding="md" className="space-y-4">
      <div>
        <p className="lingua-kicker text-[var(--action-primary)]">Bản dịch tiếng Việt</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Xem trước theo từng câu</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
          Dán JSON có danh sách câu. Mỗi số thứ tự và câu tiếng Anh phải khớp chính xác với phần xem trước từ máy chủ.
        </p>
      </div>
      <label className="block text-sm font-medium text-[var(--text-primary)]" htmlFor="translation-json">
        JSON các cặp tiếng Anh – tiếng Việt
        <textarea
          id="translation-json"
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          rows={5}
          className={inputClass}
          spellCheck={false}
          placeholder="Dán JSON chứa danh sách sentences hoặc entries"
        />
      </label>
      <Button type="button" variant="outline" disabled={busy || !importText.trim()} onClick={previewImport}>
        Xem trước các cặp câu
      </Button>
      {importErrors.length > 0 && (
        <InlineAlert variant="danger" title="Cần sửa dữ liệu trước khi lưu">
          <ul className="list-disc space-y-1 pl-5">
            {importErrors.map((error, index) => <li key={`${index}:${error}`}>{error}</li>)}
          </ul>
        </InlineAlert>
      )}
      {preview && (
        <div className="max-h-80 overflow-auto rounded-xl border border-[var(--border-subtle)]" aria-label="Bản xem trước tiếng Việt">
          <ol className="divide-y divide-[var(--border-subtle)]">
            {preview.map((entry) => (
              <li key={entry.ordinal} className="grid gap-2 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)]">Câu {entry.ordinal} · English</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--text-primary)]">{entry.sourceText}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)]">Tiếng Việt</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--text-primary)]">{entry.translationText}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <SourceField label="Tác giả bản dịch" value={source.authorName} onChange={(value) => updateSource('authorName', value)} maxLength={200} />
        <SourceField label="Tên nguồn bản dịch" value={source.sourceName} onChange={(value) => updateSource('sourceName', value)} maxLength={200} />
        <SourceField label="Phiên bản nguồn" value={source.sourceVersion} onChange={(value) => updateSource('sourceVersion', value)} maxLength={100} />
        <SourceField label="Ghi công bản dịch" value={source.attributionText} onChange={(value) => updateSource('attributionText', value)} maxLength={1000} multiline />
        <SourceField label="Quyền sử dụng bản dịch" value={source.rightsStatement} onChange={(value) => updateSource('rightsStatement', value)} maxLength={1000} multiline />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || !preview || !hasCompleteSource(source)} onClick={save}>
          {busy ? 'Đang lưu bản dịch…' : 'Lưu toàn bộ bản dịch'}
        </Button>
        {content.translationSource && (
          <>
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={confirmClear} onChange={(event) => setConfirmClear(event.target.checked)} />
              Tôi xác nhận xóa bộ dịch hiện tại
            </label>
            <Button type="button" variant="outline" disabled={busy || !confirmClear} onClick={onClear}>
              Xóa bộ dịch tiếng Việt
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function readRows(value: unknown): Array<Record<string, unknown>> | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.sentences) ? record.sentences : record.entries;
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object')) return null;
  return rows as Array<Record<string, unknown>>;
}

function hasCompleteSource(source: TranslationSource): boolean {
  return Object.values(source).every((value) => value.trim().length > 0);
}

function SourceField({
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  maxLength: number;
  multiline?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-[var(--text-primary)]">
      {label}
      {multiline ? (
        <textarea required value={value} maxLength={maxLength} rows={2} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      ) : (
        <input required value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      )}
    </label>
  );
}

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-[var(--text-primary)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]';
