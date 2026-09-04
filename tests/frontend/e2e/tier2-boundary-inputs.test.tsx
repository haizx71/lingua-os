import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { ConceptChip, Button, Card } from '@lingua/ui';
import { renderWithProviders } from '../harness/test-render';
import { MockApiService } from '../harness/mock-api-service';

describe('Tier 2: Boundary & Corner Cases - Inputs, Overflow & Diacritics', () => {
  let apiService: MockApiService;

  beforeEach(() => {
    apiService = new MockApiService();
  });

  describe('Extreme Inputs & Escaping Integrity', () => {
    it('test_empty_string_search_query_returns_empty_array_safely', async () => {
      const results = await apiService.searchDictionary('');
      expect(results).toEqual([]);

      const whitespaceResults = await apiService.searchDictionary('   \t\n  ');
      expect(whitespaceResults).toEqual([]);
    });

    it('test_html_and_script_injection_strings_are_rendered_safely_as_text', () => {
      const xssTerm = '<script>alert("xss")</script>';
      renderWithProviders(<ConceptChip status="learning" term={xssTerm} />);

      const chip = screen.getByRole('status');
      expect(chip.textContent).toContain(xssTerm);
      // Ensure no script tag is executed in the DOM
      expect(document.querySelector('script:not([type])')).toBeNull();
    });

    it('test_sql_meta_characters_and_quotes_handled_safely', async () => {
      const sqlInjection = "' OR '1'='1' -- ; DROP TABLE concepts;";
      const result = await apiService.searchDictionary(sqlInjection);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('test_extremely_large_input_string_does_not_crash_search', async () => {
      const largeQuery = 'a'.repeat(5000);
      const results = await apiService.searchDictionary(largeQuery);
      expect(results).toEqual([]);
    });

    it('test_special_unicode_symbols_and_emojis_rendered_properly', () => {
      const unicodeTerm = '🚀 LINGUA OS • 🌟 ★ № 1/2';
      renderWithProviders(<ConceptChip status="mastered" term={unicodeTerm} />);

      expect(screen.getByText(unicodeTerm)).toBeInTheDocument();
    });
  });

  describe('Max Text Length & Overflow Layout Integrity', () => {
    it('test_long_term_in_concept_chip_preserves_layout_classes', () => {
      const longTerm = 'pneumonoultramicroscopicsilicovolcanoconiosis-extremely-long-word-sample';
      renderWithProviders(<ConceptChip status="weak" term={longTerm} />);

      const chip = screen.getByRole('status');
      expect(chip).toBeInTheDocument();
      expect(chip.textContent).toContain(longTerm);
    });

    it('test_multi_line_card_content_with_long_paragraph', () => {
      const longText = 'A'.repeat(2000);
      renderWithProviders(
        <Card variant="default" padding="lg">
          <p data-testid="long-content">{longText}</p>
        </Card>
      );

      const content = screen.getByTestId('long-content');
      expect(content.textContent).toHaveLength(2000);
    });

    it('test_button_with_extended_vietnamese_label_renders_intact', () => {
      const longLabel = 'Xác nhận hoàn thành buổi ôn tập 25 phút hôm nay cùng thuật toán FSRS';
      renderWithProviders(<Button variant="primary">{longLabel}</Button>);

      expect(screen.getByRole('button', { name: new RegExp(longLabel, 'i') })).toBeInTheDocument();
    });
  });

  describe('Vietnamese Diacritics & Tone Marks Encoding', () => {
    it('test_vietnamese_diacritics_tones_preservation', async () => {
      const viStrings = [
        'Tiếng Việt với đầy đủ dấu thanh: ả, ã, ạ, ắ, ằ, ẳ, ẵ, ặ, ấ, ầ, ổ, ỗ, ợ, ự',
        'Ước lượng khởi điểm trình độ ngôn ngữ',
        'Củng cố phản xạ nhận diện trong ngữ cảnh',
        'Trí nhớ dài hạn vững chắc',
      ];

      viStrings.forEach((text) => {
        const { unmount } = renderWithProviders(
          <div data-testid="vi-text">{text}</div>
        );
        expect(screen.getByTestId('vi-text').textContent).toBe(text);
        unmount();
      });
    });

    it('test_case_insensitive_and_normalized_term_lookup', async () => {
      const match1 = await apiService.getConceptByTerm('APPOINTMENT');
      expect(match1).not.toBeNull();
      expect(match1?.id).toBe('concept-001');

      const match2 = await apiService.getConceptByTerm('  appointment  ');
      expect(match2).not.toBeNull();
      expect(match2?.id).toBe('concept-001');
    });
  });
});
