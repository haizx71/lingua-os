'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  Award,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Filter,
  Eye,
  X,
  BookOpen,
} from 'lucide-react';
import { type ConceptStatus, type CEFRLevel, type ApiErrorCode } from '@lingua/types';
import { defaultBrainNodes, type BrainNodeItem } from '../../fixtures/brainFixture';


if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface LanguageBrainCanvasProps {
  initialNodes?: BrainNodeItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onSelectConcept?: (node: BrainNodeItem) => void;
}

export function LanguageBrainCanvas({
  initialNodes = defaultBrainNodes,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSelectConcept,
}: LanguageBrainCanvasProps) {
  const [nodes, setNodes] = useState<BrainNodeItem[]>(initialNodes);
  const [selectedCefr, setSelectedCefr] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<BrainNodeItem | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cameraRef = useRef({ x: 0, y: 0, scale: 1.0 });
  const prefersReducedMotion = usePrefersReducedMotion();

  const { contextSafe } = useGSAP({ scope: viewportRef });

  const animateCamera = contextSafe((targetX: number, targetY: number, targetScale: number) => {
    if (!stageRef.current) return;

    cameraRef.current = { x: targetX, y: targetY, scale: targetScale };

    if (prefersReducedMotion) {
      gsap.set(stageRef.current, {
        x: targetX,
        y: targetY,
        scale: targetScale,
        transformOrigin: '0 0',
      });
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

  const centerNode = useCallback(
    (node: BrainNodeItem, explicitZoom?: number) => {
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

      // Soft clamping
      const maxClampX = 24;
      const minClampX = Math.min(0, vW - sW * scale - 24);
      const maxClampY = 24;
      const minClampY = Math.min(0, vH - sH * scale - 24);

      targetX = Math.max(minClampX, Math.min(maxClampX, targetX));
      targetY = Math.max(minClampY, Math.min(maxClampY, targetY));

      animateCamera(targetX, targetY, scale);
    },
    [zoomLevel, animateCamera]
  );

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (selectedCefr !== 'ALL' && n.cefr !== selectedCefr) return false;
      if (selectedStatus !== 'ALL' && n.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesLabel = n.label.toLowerCase().includes(q);
        const matchesMeaning = n.translationVi.toLowerCase().includes(q);
        if (!matchesLabel && !matchesMeaning) return false;
      }
      return true;
    });
  }, [nodes, selectedCefr, selectedStatus, searchQuery]);

  const handleNodeClick = (node: BrainNodeItem) => {
    setSelectedNode(node);
    if (onSelectConcept) {
      onSelectConcept(node);
    }
    centerNode(node);
  };

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(50, Math.min(150, newZoom));
    setZoomLevel(clampedZoom);

    if (selectedNode) {
      centerNode(selectedNode, clampedZoom);
    } else {
      const viewportEl = viewportRef.current;
      const vW = viewportEl?.clientWidth || 600;
      const vH = viewportEl?.clientHeight || 460;
      const oldScale = cameraRef.current.scale;
      const newScale = clampedZoom / 100;

      const centerX = (vW / 2 - cameraRef.current.x) / oldScale;
      const centerY = (vH / 2 - cameraRef.current.y) / oldScale;

      const targetX = vW / 2 - centerX * newScale;
      const targetY = vH / 2 - centerY * newScale;

      animateCamera(targetX, targetY, newScale);
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    animateCamera(0, 0, 1.0);
  };

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => {
      setCurrentState('success');
    }, 400);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang tải dữ liệu mạng lưới Language Brain..." count={4} />;
  }

  if (currentState === 'error') {
    return <ErrorState code={errorCode} onRetry={handleRetry} />;
  }

  if (currentState === 'empty') {
    return (
      <EmptyState
        title="Chưa có từ vựng trong Brain"
        description="Hãy bắt đầu đọc bài trong Reader hoặc làm bài kiểm tra khởi điểm để hệ thống xây dựng Language Brain cho bạn."
        actionLabel="Bắt đầu đọc bài"
        onAction={() => {
          window.location.href = '/read';
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <header>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
          Learner State Model
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Language Brain của bạn
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Bản đồ ghi nhớ thể hiện toàn bộ bằng chứng nhận diện, nghe và sử dụng từ vựng của bạn.
        </p>
      </header>

      {/* Metrics Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card variant="default" padding="md">
          <span className="text-xs text-[var(--text-secondary)] font-medium">
            Đã vững (Mastered)
          </span>
          <div className="text-2xl font-bold text-[var(--status-success)] mt-1">483</div>
          <span className="text-[11px] text-[var(--text-muted)]">Trí nhớ dài hạn FSRS</span>
        </Card>

        <Card variant="default" padding="md">
          <span className="text-xs text-[var(--text-secondary)] font-medium">
            Đang học (Learning)
          </span>
          <div className="text-2xl font-bold text-[var(--status-info)] mt-1">71</div>
          <span className="text-[11px] text-[var(--text-muted)]">Đang củng cố phản xạ</span>
        </Card>

        <Card variant="default" padding="md">
          <span className="text-xs text-[var(--text-secondary)] font-medium">
            Cần ôn (Weak / Due)
          </span>
          <div className="text-2xl font-bold text-[var(--status-warning)] mt-1">28</div>
          <span className="text-[11px] text-[var(--text-muted)]">Ưu tiên ôn hôm nay</span>
        </Card>

        <Card variant="default" padding="md">
          <span className="text-xs text-[var(--text-secondary)] font-medium">
            Sức khỏe trí nhớ
          </span>
          <div className="text-2xl font-bold text-[var(--action-primary)] mt-1">87%</div>
          <span className="text-[11px] text-[var(--text-muted)]">Mức duy trì cao</span>
        </Card>
      </div>

      {/* Tri-dimensional Evidence Breakdown */}
      <Card variant="default" padding="lg" className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Bằng chứng năng lực theo chiều kỹ năng
        </h2>
        <div className="space-y-3">
          <Progress
            value={72}
            max={100}
            label="Nhận diện khi đọc (Recognition Evidence)"
            showValueText
            size="sm"
          />
          <Progress
            value={54}
            max={100}
            label="Nhận diện khi nghe (Listening Evidence)"
            showValueText
            size="sm"
            variant="warning"
          />
          <Progress
            value={38}
            max={100}
            label="Năng lực tự sử dụng (Production Evidence)"
            showValueText
            size="sm"
            variant="warning"
          />
        </div>
      </Card>

      {/* Interactive Concept Canvas & Filter Controls */}
      <Card variant="default" padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[var(--action-primary)]" />
            <h3 className="font-semibold text-base text-[var(--text-primary)]">
              Mạng lưới khái niệm & từ vựng ({filteredNodes.length} từ)
            </h3>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleZoomChange(zoomLevel - 10)}
              aria-label="Thu nhỏ mạng lưới"
              title="Thu nhỏ (-10%)"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-[var(--text-muted)] font-mono w-12 text-center">{zoomLevel}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleZoomChange(zoomLevel + 10)}
              aria-label="Phóng to mạng lưới"
              title="Phóng to (+10%)"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetZoom}
              aria-label="Đặt lại thu phóng"
              title="Reset Zoom (100%)"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Lọc từ vựng trong Brain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>

          {/* CEFR Level Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--text-muted)] font-medium mr-1">CEFR:</span>
            {['ALL', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedCefr(lvl)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  selectedCefr === lvl
                    ? 'bg-[var(--action-primary)] text-[var(--action-primary-text)]'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--text-muted)] font-medium mr-1">Trạng thái:</span>
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'mastered', label: 'Đã vững' },
              { id: 'learning', label: 'Đang học' },
              { id: 'weak', label: 'Cần củng cố' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStatus(st.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  selectedStatus === st.id
                    ? 'bg-[var(--action-primary)] text-[var(--action-primary-text)]'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Concept Network Grid / Canvas Viewport & Stage */}
        <div
          ref={viewportRef}
          className="relative w-full h-[460px] sm:h-[520px] rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)] overflow-hidden"
        >
          <div
            ref={stageRef}
            className="p-6 flex flex-wrap content-start gap-3 will-change-transform"
            style={{ transformOrigin: '0 0' }}
          >
            {filteredNodes.length === 0 ? (
              <div className="w-full text-center py-12 text-sm text-[var(--text-secondary)]">
                Không tìm thấy từ vựng nào khớp với bộ lọc.
              </div>
            ) : (
              filteredNodes.map((node) => (
                <button
                  key={node.id}
                  ref={(el) => {
                    nodeRefs.current[node.id] = el;
                  }}
                  type="button"
                  onClick={() => handleNodeClick(node)}
                  className="focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] rounded-xl"
                >
                  <ConceptChip
                    status={node.status}
                    isDue={node.isDue}
                    term={node.label}
                    size="md"
                    className={`cursor-pointer hover:shadow-sm ${selectedNode?.id === node.id ? 'ring-2 ring-[var(--focus-ring)] shadow-md' : ''}`}
                  />
                </button>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Selected Concept Detail Drawer */}
      {selectedNode && (
        <div
          role="dialog"
          aria-label="Chi tiết khái niệm"
          className="fixed inset-x-4 bottom-20 md:bottom-8 md:inset-x-auto md:right-8 md:w-96 z-50 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xl animate-fadeIn space-y-4"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  {selectedNode.label}
                </h3>
                <Badge variant="primary" size="sm">
                  {selectedNode.cefr}
                </Badge>
              </div>
              {(selectedNode.ipa || selectedNode.pos) && (
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                  {[selectedNode.ipa, selectedNode.pos].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedNode(null)}
              aria-label="Đóng bảng chi tiết"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">{selectedNode.translationVi}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Nhóm: {selectedNode.groupLabel}</p>
          </div>

          {/* Skill Radar / Progress */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Bằng chứng 3 chiều:
            </span>
            <Progress
              value={selectedNode.recognitionScore}
              max={100}
              label={`Nhận diện: ${selectedNode.recognitionScore}%`}
              size="sm"
            />
            <Progress
              value={selectedNode.listeningScore}
              max={100}
              label={`Nghe: ${selectedNode.listeningScore}%`}
              size="sm"
              variant="warning"
            />
            <Progress
              value={selectedNode.productionScore}
              max={100}
              label={`Tự dùng: ${selectedNode.productionScore}%`}
              size="sm"
              variant="warning"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Link href="/review">
              <Button variant="primary" size="sm">
                Ôn tập từ này
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
