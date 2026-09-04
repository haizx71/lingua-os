import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ReaderSentence } from './ReaderSentence';

const meta: Meta<typeof ReaderSentence> = {
  title: 'Domain/ReaderSentence',
  component: ReaderSentence,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ReaderSentence>;

const sampleTokens = [
  { raw: 'I', lemma: 'i' },
  { raw: 'would', lemma: 'would' },
  { raw: 'like', lemma: 'like' },
  { raw: 'to', lemma: 'to' },
  { raw: 'make', lemma: 'make' },
  { raw: 'an', lemma: 'a' },
  { raw: 'appointment', lemma: 'appointment', status: 'learning' as const },
  { raw: 'with', lemma: 'with' },
  { raw: 'Dr.', lemma: 'dr' },
  { raw: 'Watson', lemma: 'watson' },
  { raw: 'tomorrow', lemma: 'tomorrow' },
  { raw: 'if', lemma: 'if' },
  { raw: 'he', lemma: 'he' },
  { raw: 'is', lemma: 'be' },
  { raw: 'available.', lemma: 'available', status: 'mastered' as const },
];

export const Default: Story = {
  render: () => (
    <div className="w-[640px] p-4">
      <ReaderSentence
        text="I would like to make an appointment with Dr. Watson tomorrow if he is available."
        tokens={sampleTokens}
        translation="Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai nếu ông ấy có thời gian."
        targetWords={[
          { term: 'appointment', status: 'learning' },
          { term: 'available', status: 'mastered' },
        ]}
      />
    </div>
  ),
};

export const TranslationOpened: Story = {
  render: () => (
    <div className="w-[640px] p-4">
      <ReaderSentence
        text="I would like to make an appointment with Dr. Watson tomorrow if he is available."
        tokens={sampleTokens}
        translation="Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai nếu ông ấy có thời gian."
        showTranslationDefault={true}
        targetWords={[
          { term: 'appointment', status: 'learning' },
          { term: 'available', status: 'mastered' },
        ]}
      />
    </div>
  ),
};

export const InteractiveInspector: Story = {
  render: () => {
    const [selectedWord, setSelectedWord] = useState<string | null>(null);

    return (
      <div className="w-[640px] space-y-4 p-4">
        <ReaderSentence
          text="I would like to make an appointment with Dr. Watson tomorrow if he is available."
          tokens={sampleTokens}
          translation="Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai nếu ông ấy có thời gian."
          onWordClick={(token) => setSelectedWord(token.raw)}
          targetWords={[
            { term: 'appointment', status: 'learning' },
            { term: 'available', status: 'mastered' },
          ]}
        />
        {selectedWord && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-xs text-indigo-900 dark:text-indigo-200 border border-indigo-200">
            Bạn vừa bấm vào từ: <strong>{selectedWord}</strong> (Tra cứu tức thì trong ngữ cảnh)
          </div>
        )}
      </div>
    );
  },
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-xl w-[640px] border border-slate-800 text-slate-100">
      <ReaderSentence
        text="I would like to make an appointment with Dr. Watson tomorrow if he is available."
        tokens={sampleTokens}
        translation="Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai nếu ông ấy có thời gian."
        showTranslationDefault={true}
        targetWords={[
          { term: 'appointment', status: 'learning' },
          { term: 'available', status: 'mastered' },
        ]}
      />
    </div>
  ),
};
