import { describe, expect, it } from 'vitest';
import { selectK2HostedExerciseMode } from './k2_hosted_wave_k2_07';
import type { K2HostedAnchorMaterial } from './k2_hosted_probe_client';

const noMaterial: K2HostedAnchorMaterial = {
  hasTranslatedDefinition: false,
  hasHttpsAudio: false,
  hasPublishedClozeTarget: false,
};

function signals(overrides: Partial<Record<'recognition' | 'listening' | 'production', {
  score: number;
  evidenceCount: number;
}>> = {}) {
  return {
    recognition: { score: 0.5, evidenceCount: 0 },
    listening: { score: 0.5, evidenceCount: 0 },
    production: { score: 0.5, evidenceCount: 0 },
    ...overrides,
  };
}

describe('K2-07 fixture mode policy', () => {
  it('uses self-recall when no competence dimension has evidence', () => {
    expect(selectK2HostedExerciseMode(signals(), noMaterial)).toBe('self_recall');
  });

  it('skips a weaker dimension without canonical material and uses the next available mode', () => {
    expect(selectK2HostedExerciseMode(signals({
      listening: { score: 0.1, evidenceCount: 1 },
      production: { score: 0.3, evidenceCount: 1 },
    }), {
      ...noMaterial,
      hasTranslatedDefinition: true,
    })).toBe('typing');
  });

  it('selects the weakest observed dimension when its canonical material is available', () => {
    expect(selectK2HostedExerciseMode(signals({
      recognition: { score: 0.2, evidenceCount: 1 },
      production: { score: 0.3, evidenceCount: 1 },
    }), {
      hasTranslatedDefinition: true,
      hasHttpsAudio: false,
      hasPublishedClozeTarget: true,
    })).toBe('cloze');
  });

  it('rejects incomplete competence evidence instead of guessing a mode', () => {
    expect(() => selectK2HostedExerciseMode({ production: { score: 0.5, evidenceCount: 0 } }, noMaterial))
      .toThrow('competence signals were invalid');
  });
});
