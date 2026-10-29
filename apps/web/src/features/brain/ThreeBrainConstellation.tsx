'use client';

import * as THREE from 'three';
import React, { useEffect, useRef } from 'react';
import type { BrainNodeItem } from '../../fixtures/brainFixture';

export interface ThreeBrainConstellationProps {
  nodes: readonly BrainNodeItem[];
  selectedNodeId?: string | null;
  prefersReducedMotion?: boolean;
  onSelectNode?: (node: BrainNodeItem) => void;
}

export function ThreeBrainConstellation({
  nodes,
  selectedNodeId,
  prefersReducedMotion = false,
  onSelectNode,
}: ThreeBrainConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Graceful fallback when WebGL or Canvas rendering is unavailable in headless/JSDOM test runners
    if (
      typeof window === 'undefined' ||
      typeof HTMLCanvasElement === 'undefined' ||
      typeof window.WebGLRenderingContext === 'undefined' ||
      !canvasRef.current
    ) {
      return;
    }

    const canvas = canvasRef.current;
    let renderer: THREE.WebGLRenderer | null = null;
    let rafId: number | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let pointsMaterial: THREE.PointsMaterial | null = null;
    let lineGeo: THREE.BufferGeometry | null = null;
    let lineMat: THREE.LineBasicMaterial | null = null;

    const handleResize = () => {
      if (!canvas || !renderer) return;
      const width = canvas.clientWidth || 600;
      const height = canvas.clientHeight || 300;
      camera.aspect = width / (height || 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    // Camera and Scene pre-allocation
    const initialWidth = canvas.clientWidth || 600;
    const initialHeight = canvas.clientHeight || 300;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, initialWidth / (initialHeight || 1), 0.1, 100);
    camera.position.z = 14;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(initialWidth, initialHeight, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const count = nodes.length;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      // Pre-allocate color instance outside loop to avoid GC pressure
      const tempColor = new THREE.Color();

      const radius = 6.0;
      const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio for spherical Fibonacci lattice

      for (let i = 0; i < count; i++) {
        const node = nodes[i];
        const y = count > 1 ? 1 - (i / (count - 1)) * 2 : 0;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = 2 * Math.PI * i * (1 / phi);

        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;

        positions[i * 3] = x * radius;
        positions[i * 3 + 1] = y * radius;
        positions[i * 3 + 2] = z * radius;

        if (node.id === selectedNodeId) {
          tempColor.setHex(0x5eead4); // Bright teal highlight
        } else if (node.status === 'mastered') {
          tempColor.setHex(0x10b981); // Emerald
        } else if (node.status === 'learning') {
          tempColor.setHex(0x38bdf8); // Sky blue
        } else if (node.status === 'weak') {
          tempColor.setHex(0xf59e0b); // Amber
        } else if (node.status === 'forgotten') {
          tempColor.setHex(0xf43f5e); // Rose
        } else {
          tempColor.setHex(0xa78bfa); // Violet
        }

        colors[i * 3] = tempColor.r;
        colors[i * 3 + 1] = tempColor.g;
        colors[i * 3 + 2] = tempColor.b;
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      pointsMaterial = new THREE.PointsMaterial({
        size: 0.55,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
      });
      const pointsMesh = new THREE.Points(geometry, pointsMaterial);
      scene.add(pointsMesh);

      // Subtle connecting wireframe between sequential nodes
      if (count > 1) {
        const linePositions: number[] = [];
        for (let i = 0; i < count - 1; i++) {
          linePositions.push(
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2],
            positions[(i + 1) * 3],
            positions[(i + 1) * 3 + 1],
            positions[(i + 1) * 3 + 2]
          );
        }
        lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        lineMat = new THREE.LineBasicMaterial({
          color: 0x2dd4bf,
          transparent: true,
          opacity: 0.28,
        });
        const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
        scene.add(lineSegments);
      }

      window.addEventListener('resize', handleResize);

      const renderOnce = () => {
        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      if (!prefersReducedMotion) {
        const animate = () => {
          pointsMesh.rotation.y += 0.003;
          scene.traverse((obj) => {
            if (obj instanceof THREE.LineSegments) {
              obj.rotation.y = pointsMesh.rotation.y;
            }
          });
          renderOnce();
          rafId = requestAnimationFrame(animate);
        };
        animate();
      } else {
        renderOnce();
      }
    } catch {
      // Graceful fallback for environments without WebGL support
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', handleResize);
      geometry?.dispose();
      pointsMaterial?.dispose();
      lineGeo?.dispose();
      lineMat?.dispose();
      renderer?.dispose();
      scene.clear();
    };
  }, [nodes, selectedNodeId, prefersReducedMotion]);

  return (
    <div
      data-testid="brain-threejs-canvas-container"
      data-threejs-engine="three-r170"
      className="relative min-h-[220px] overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-gradient-to-br from-[#131629] via-[#1B1F3B] to-[#112A34] p-4 text-white shadow-lg sm:min-h-[260px]"
    >
      <canvas
        ref={canvasRef}
        data-testid="brain-threejs-webgl-canvas"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-85"
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span
            data-testid="brain-3d-orbit-status"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-200"
          >
            🪐 Mạng tinh vân 3D Three.js • {nodes.length} điểm nút
          </span>
        </div>
        <span className="text-[11px] text-teal-300/70">
          Không gian tri thức 3D tương tác
        </span>
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap gap-2">
        {nodes.length === 0 ? (
          <div className="py-6 text-xs text-teal-200/60">
            Không có điểm nút nào để hiển thị trong tinh vân 3D
          </div>
        ) : (
          nodes.slice(0, 18).map((node) => {
            const isSelected = selectedNodeId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                data-testid={`brain-3d-node-${node.id}`}
                aria-label={`Điểm nút 3D [${node.id}]`}
                onClick={() => onSelectNode?.(node)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-teal-400 font-bold text-slate-950 shadow-md ring-2 ring-white/80'
                    : 'border border-white/15 bg-white/10 text-white hover:bg-white/20'
                }`}
                aria-pressed={isSelected}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    node.status === 'mastered'
                      ? 'bg-emerald-400'
                      : node.status === 'learning'
                        ? 'bg-cyan-400'
                        : node.status === 'weak'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                  }`}
                />
                <span>🪐 {node.label}</span>
                {node.cefr && <span className="text-[10px] opacity-60">{node.cefr}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
