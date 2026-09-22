'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Button,
  Card,
  Badge,
  ConceptChip,
  Progress,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
  componentMotionNumeric,
  usePrefersReducedMotion,
} from '@lingua/ui';
import {
  Brain,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  X,
  ArrowRight,
} from 'lucide-react';
import { type ApiErrorCode, type BrainSummaryViewModel } from '@lingua/types';
import { defaultBrainNodes, type BrainNodeItem } from '../../fixtures/brainFixture';

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP);

export interface LanguageBrainCanvasProps {
  initialNodes?: readonly BrainNodeItem[];
  nodes?: readonly BrainNodeItem[];
  contextKey?: string;
  summary?: BrainSummaryViewModel | null;
  state?: 'loading' | 'empty' | 'error' | 'success';
  detailNode?: BrainNodeItem | null;
  detailLoading?: boolean;
  detailError?: { message: string } | null;
  error?: { code?: string } | null;
  onRetry?: () => void;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onSelectConcept?: (node: BrainNodeItem) => void;
}

export function LanguageBrainCanvas({
  initialNodes = defaultBrainNodes,
  nodes: liveNodes,
  contextKey = 'presentation',
  summary = null,
  state,
  detailNode = null,
  detailLoading = false,
  detailError = null,
  error = null,
  onRetry,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSelectConcept,
}: LanguageBrainCanvasProps) {
  const nodes = liveNodes ?? initialNodes;
  const [selectedCefr, setSelectedCefr] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<BrainNodeItem | null>(null);
  const [selectedContextKey, setSelectedContextKey] = useState(contextKey);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [localForcedState, setLocalForcedState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const currentState = state ?? localForcedState;

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cameraRef = useRef({ x: 0, y: 0, scale: 1.0 });
  const prefersReducedMotion = usePrefersReducedMotion();
  const { contextSafe } = useGSAP({ scope: viewportRef });

  useEffect(() => setLocalForcedState(forcedState), [forcedState]);
  useEffect(() => {
    if (selectedNode && !nodes.some((node) => node.id === selectedNode.id)) setSelectedNode(null);
  }, [nodes, selectedNode]);
  useEffect(() => {
    setSelectedNode(null);
    setSelectedContextKey(contextKey);
  }, [contextKey]);

  const selectedNodeForContext = selectedContextKey === contextKey ? selectedNode : null;

  const animateCamera = contextSafe((targetX: number, targetY: number, targetScale: number) => {
    if (!stageRef.current) return;
    cameraRef.current = { x: targetX, y: targetY, scale: targetScale };
    if (prefersReducedMotion) {
      gsap.set(stageRef.current, { x: targetX, y: targetY, scale: targetScale, transformOrigin: '0 0' });
      return;
    }
    gsap.to(stageRef.current, {
      x: targetX,
      y: targetY,
      scale: targetScale,
      duration: componentMotionNumeric.brainCanvas.panDuration,
      ease: componentMotionNumeric.brainCanvas.panEase,
      overwrite: 'auto',
      transformOrigin: '0 0',
    });
  });

  const centerNode = useCallback((node: BrainNodeItem, explicitZoom?: number) => {
    const nodeEl = nodeRefs.current[node.id];
    const viewportEl = viewportRef.current;
    const stageEl = stageRef.current;
    if (!nodeEl || !viewportEl || !stageEl) return;

    const scale = (explicitZoom ?? zoomLevel) / 100;
    const vW = viewportEl.clientWidth || 600;
    const vH = viewportEl.clientHeight || 460;
    const sW = stageEl.scrollWidth || stageEl.clientWidth || 600;
    const sH = stageEl.scrollHeight || stageEl.clientHeight || 460;
    const nodeX = nodeEl.offsetLeft + nodeEl.offsetWidth / 2;
    const nodeY = nodeEl.offsetTop + nodeEl.offsetHeight / 2;
    let targetX = vW / 2 - nodeX * scale;
    let targetY = vH / 2 - nodeY * scale;
    targetX = Math.max(Math.min(0, vW - sW * scale - 24), Math.min(24, targetX));
    targetY = Math.max(Math.min(0, vH - sH * scale - 24), Math.min(24, targetY));
    animateCamera(targetX, targetY, scale);
  }, [zoomLevel, animateCamera]);

  const filteredNodes = useMemo(() => nodes.filter((n) => {
    if (selectedCefr !== 'ALL' && n.cefr !== selectedCefr) return false;
    if (selectedStatus !== 'ALL' && n.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!n.label.toLowerCase().includes(q) && !n.translationVi.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [nodes, selectedCefr, selectedStatus, searchQuery]);

  const handleNodeClick = (node: BrainNodeItem) => {
    setSelectedContextKey(contextKey);
    setSelectedNode(node);
    onSelectConcept?.(node);
    centerNode(node);
  };

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(50, Math.min(150, newZoom));
    setZoomLevel(clampedZoom);
    if (selectedNodeForContext) {
      centerNode(selectedNodeForContext, clampedZoom);
      return;
    }
    const viewportEl = viewportRef.current;
    const vW = viewportEl?.clientWidth || 600;
    const vH = viewportEl?.clientHeight || 460;
    const oldScale = cameraRef.current.scale;
    const newScale = clampedZoom / 100;
    const centerX = (vW / 2 - cameraRef.current.x) / oldScale;
    const centerY = (vH / 2 - cameraRef.current.y) / oldScale;
    animateCamera(vW / 2 - centerX * newScale, vH / 2 - centerY * newScale, newScale);
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    animateCamera(0, 0, 1.0);
  };

  const handleRetry = () => {
    if (onRetry) return onRetry();
    setLocalForcedState('loading');
    setTimeout(() => setLocalForcedState('success'), 400);
  };

  const visibleSelectedNode = detailNode && selectedNodeForContext?.id === detailNode.id ? detailNode : selectedNodeForContext;
  const displayPercent = (value: number | null | undefined): string => value == null ? 'Chưa có dữ liệu' : `${Math.round(value * 100)}%`;
  const summaryCount = (key: keyof BrainSummaryViewModel['statusCounts']): string => summary ? String(summary.statusCounts[key]) : '—';
  const summarySkillPercent = (dimension: 'recognition' | 'listening' | 'production'): number => summary ? Math.round(summary.competence[dimension].score * 100) : 0;
  const memoryPercent = summary?.memoryHealth == null ? 0 : Math.round(summary.memoryHealth * 100);

  if (currentState === 'loading') return <LoadingState message="Đang tải dữ liệu mạng lưới Language Brain..." count={4} />;
  if (currentState === 'error') return <ErrorState code={error?.code ?? forcedErrorCode} title="Không thể tải Language Brain" message="Không thể tải dữ liệu Language Brain. Vui lòng thử lại sau." onRetry={handleRetry} />;
  if (currentState === 'empty') return <EmptyState title="Chưa có từ vựng trong Brain" description={`Hãy bắt đầu đọc bài trong Reader hoặc làm bài kiểm tra khởi điểm để hệ thống xây dựng Language Brain cho bạn. ${summary?.memoryHealth == null ? 'Chưa có dữ liệu sức khỏe trí nhớ.' : ''}`} actionLabel="Bắt đầu đọc bài" onAction={() => { window.location.href = '/read'; }} />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="min-w-0">
        <div className="lingua-kicker text-[var(--action-primary)]">Learner State Model</div>
        <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-4xl">Language Brain của bạn</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">Bản đồ ghi nhớ thể hiện toàn bộ bằng chứng nhận diện, nghe và sử dụng từ vựng của bạn.</p>
      </header>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card padding="lg" className="min-w-0 overflow-hidden rounded-[28px] bg-gradient-to-br from-white via-white to-[var(--accent-teal-soft)]">
          <div className="lingua-kicker text-[var(--accent-teal-strong)]">Sức khỏe trí nhớ</div>
          <div className="mt-5 flex flex-col items-center text-center">
            <div className="relative flex h-44 w-44 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--accent-teal) ${memoryPercent * 3.6}deg, #e8ece8 0deg)` }}>
              <div className="absolute inset-[13px] rounded-full bg-white shadow-[inset_0_0_0_1px_var(--border-subtle)]" />
              <div className="relative z-10">
                <Brain className="mx-auto h-6 w-6 text-[var(--accent-teal-strong)]" />
                <div className="mt-1 text-4xl font-black tracking-[-0.06em] text-[var(--text-primary)]">{displayPercent(summary?.memoryHealth)}</div>
                <div className="mt-1 text-xs font-bold text-[var(--text-muted)]">trạng thái trí nhớ</div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">{summary?.memoryHealth == null ? 'Chưa đủ bằng chứng để tính sức khỏe trí nhớ.' : 'Theo dõi độ bền của những gì bạn đã học.'}</p>
            <span className="sr-only">Trí nhớ dài hạn FSRS</span>
          </div>
        </Card>

        <Card padding="lg" className="min-w-0 rounded-[28px]">
          <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><div className="lingua-kicker">Competence evidence</div><h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">Bằng chứng năng lực theo chiều kỹ năng</h2></div><Sparkles className="h-5 w-5 shrink-0 text-[var(--accent-teal)]" /></div>
          <div className="mt-6 space-y-5">
            <Progress value={summarySkillPercent('recognition')} max={100} label="Nhận diện khi đọc" showValueText size="sm" />
            <Progress value={summarySkillPercent('listening')} max={100} label="Nhận diện khi nghe" showValueText size="sm" variant="warning" />
            <Progress value={summarySkillPercent('production')} max={100} label="Năng lực tự sử dụng" showValueText size="sm" variant="warning" />
          </div>
        </Card>
      </section>

      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Đã vững (Mastered)', summaryCount('mastered'), 'var(--accent-teal-soft)', 'var(--accent-teal-strong)'],
          ['Đang học (Learning)', summaryCount('learning'), 'var(--surface-blue)', 'var(--action-primary)'],
          ['Cần ôn (Weak / Due)', summaryCount('weak'), 'var(--surface-warm)', 'var(--status-warning)'],
          ['Tổng khái niệm', String(nodes.length), 'var(--surface-lilac)', 'var(--accent-purple)'],
        ].map(([label, value, bg, color]) => (
          <div key={label} className="min-w-0 rounded-[22px] border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-card)]" style={{ background: bg }}>
            <span className="truncate text-xs font-semibold text-[var(--text-muted)]">{label}</span>
            <div className="mt-1 text-2xl font-black tracking-[-0.04em]" style={{ color }}>{value}</div>
          </div>
        ))}
      </section>

      <Card padding="lg" className="min-w-0 overflow-hidden rounded-[28px]">
        <div className="flex min-w-0 flex-col gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><Brain className="h-5 w-5 shrink-0 text-[var(--action-primary)]" /><h3 className="truncate text-base font-black text-[var(--text-primary)]">Mạng lưới khái niệm</h3></div><p className="mt-1 text-xs text-[var(--text-muted)]">{filteredNodes.length} từ đang hiển thị</p><span className="sr-only">Mạng lưới khái niệm &amp; từ vựng ({filteredNodes.length} từ)</span></div>
          <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-[var(--surface-subtle)] p-1">
            <Button variant="ghost" size="icon" onClick={() => handleZoomChange(zoomLevel - 10)} aria-label="Thu nhỏ mạng lưới"><ZoomOut className="h-4 w-4" /></Button>
            <span className="w-11 text-center font-mono text-[11px] text-[var(--text-muted)]">{zoomLevel}%</span>
            <Button variant="ghost" size="icon" onClick={() => handleZoomChange(zoomLevel + 10)} aria-label="Phóng to mạng lưới"><ZoomIn className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleResetZoom} aria-label="Đặt lại thu phóng"><RotateCcw className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mt-4 min-w-0 space-y-3">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input type="text" placeholder="Lọc từ vựng trong Brain..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="min-h-11 w-full min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] pl-9 pr-3 text-base text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)] sm:text-sm" />
          </div>

          <div className="lingua-mobile-scroller -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            {['ALL', 'A1', 'A2', 'B1', 'B2'].map((lvl) => <button key={lvl} type="button" aria-label={lvl === 'ALL' ? 'ALL' : undefined} onClick={() => setSelectedCefr(lvl)} className={`min-h-10 shrink-0 snap-start rounded-xl px-3 text-xs font-bold ${selectedCefr === lvl ? 'bg-[var(--action-primary)] text-white' : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'}`}>{lvl === 'ALL' ? 'Tất cả CEFR' : lvl}</button>)}
            {[{ id: 'ALL', label: 'Tất cả' }, { id: 'mastered', label: 'Đã vững' }, { id: 'learning', label: 'Đang học' }, { id: 'weak', label: 'Cần củng cố' }].map((st) => <button key={st.id} type="button" onClick={() => setSelectedStatus(st.id)} className={`min-h-10 shrink-0 snap-start rounded-xl px-3 text-xs font-bold ${selectedStatus === st.id ? 'bg-[var(--accent-teal)] text-white' : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'}`}>{st.label}</button>)}
          </div>
        </div>

        <div ref={viewportRef} className="relative mt-4 h-[380px] w-full overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] sm:h-[520px]">
          <div ref={stageRef} className="flex min-w-full flex-wrap content-start gap-3 p-4 will-change-transform sm:p-6" style={{ transformOrigin: '0 0' }}>
            {filteredNodes.length === 0 ? <div className="w-full py-12 text-center text-sm text-[var(--text-secondary)]">Không tìm thấy từ vựng nào khớp với bộ lọc.</div> : filteredNodes.map((node) => (
              <button key={node.id} ref={(el) => { nodeRefs.current[node.id] = el; }} type="button" onClick={() => handleNodeClick(node)} className="rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]">
                <ConceptChip status={node.status} isDue={node.isDue} term={node.label} size="md" className={`cursor-pointer hover:shadow-sm ${selectedNodeForContext?.id === node.id ? 'ring-2 ring-[var(--focus-ring)] shadow-md' : ''}`} />
              </button>
            ))}
          </div>
        </div>
      </Card>

      {visibleSelectedNode && (
        <div role="dialog" aria-modal="true" aria-label="Chi tiết khái niệm" className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] max-h-[68dvh] overflow-y-auto rounded-[26px] border border-[var(--border-subtle)] bg-white p-4 shadow-[0_24px_70px_rgba(33,45,78,0.25)] sm:inset-x-auto sm:bottom-8 sm:right-8 sm:w-[390px] sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><h3 className="truncate text-xl font-black tracking-[-0.03em] text-[var(--text-primary)]">{visibleSelectedNode.label}</h3>{visibleSelectedNode.cefr && <Badge variant="primary" size="sm">{visibleSelectedNode.cefr}</Badge>}</div>{(visibleSelectedNode.ipa || visibleSelectedNode.pos) && <p className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">{[visibleSelectedNode.ipa, visibleSelectedNode.pos].filter(Boolean).join(' • ')}</p>}</div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} aria-label="Đóng bảng chi tiết"><X className="h-4 w-4" /></Button>
          </div>

          <div className="mt-4 rounded-2xl bg-[var(--surface-subtle)] p-4"><p className="font-bold text-[var(--text-primary)]">{visibleSelectedNode.translationVi}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Nhóm: {visibleSelectedNode.groupLabel}</p></div>
          {detailLoading && <p className="mt-3 text-xs text-[var(--text-secondary)]" role="status">Đang tải chi tiết khái niệm...</p>}
          {detailError && <div className="mt-3"><InlineAlert variant="danger" title="Không thể tải chi tiết khái niệm">Vui lòng thử lại bằng cách chọn lại khái niệm.</InlineAlert></div>}

          {visibleSelectedNode.grammar && (
            <section className="mt-4 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-blue)] p-4" aria-label="Giải thích ngữ pháp">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--action-primary)]">Công thức</p>
                <p className="mt-1 font-mono text-sm font-bold text-[var(--text-primary)]">{visibleSelectedNode.grammar.patternFormula}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Cách dùng</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{visibleSelectedNode.grammar.pragmaticFunction}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Giải thích tiếng Việt</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{visibleSelectedNode.grammar.vietnameseExplanation}</p>
              </div>
              {visibleSelectedNode.grammar.vietnameseCommonTraps && (
                <div className="rounded-xl bg-[var(--surface-warm)] p-3">
                  <p className="text-xs font-bold text-[var(--status-warning)]">Lỗi thường gặp</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{visibleSelectedNode.grammar.vietnameseCommonTraps}</p>
                </div>
              )}
              <ul className="space-y-2" aria-label="Thành phần cấu trúc">
                {visibleSelectedNode.grammar.structuralSlots.map((slot) => (
                  <li key={`${slot.label}:${slot.role}`} className="rounded-xl bg-white/80 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[var(--text-primary)]">{slot.label}</span>
                      <span className="text-[var(--text-muted)]">{slot.required ? 'Bắt buộc' : 'Tùy chọn'}</span>
                    </div>
                    {slot.examples.length > 0 && <p className="mt-1 text-[var(--text-secondary)]">Ví dụ: {slot.examples.join(', ')}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-[var(--surface-blue)] p-2"><span className="block text-[var(--text-muted)]">Độ vững</span><strong className="mt-1 block text-[var(--text-primary)]">{displayPercent(visibleSelectedNode.mastery)}</strong></div><div className="rounded-xl bg-[var(--accent-teal-soft)] p-2"><span className="block text-[var(--text-muted)]">Tin cậy</span><strong className="mt-1 block text-[var(--text-primary)]">{displayPercent(visibleSelectedNode.confidence)}</strong></div><div className="rounded-xl bg-[var(--surface-warm)] p-2"><span className="block text-[var(--text-muted)]">Đã gặp</span><strong className="mt-1 block text-[var(--text-primary)]">{visibleSelectedNode.exposureCount}</strong></div></div>

          <div className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4"><Progress value={visibleSelectedNode.recognitionScore} max={100} label={`Nhận diện: ${visibleSelectedNode.recognitionScore}%`} size="sm" /><Progress value={visibleSelectedNode.listeningScore} max={100} label={`Nghe: ${visibleSelectedNode.listeningScore}%`} size="sm" variant="warning" /><Progress value={visibleSelectedNode.productionScore} max={100} label={`Tự dùng: ${visibleSelectedNode.productionScore}%`} size="sm" variant="warning" /></div>
          <Link href="/review" className="mt-5 block"><Button className="w-full" variant="primary" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>Ôn tập từ này</Button></Link>
        </div>
      )}
    </div>
  );
}
