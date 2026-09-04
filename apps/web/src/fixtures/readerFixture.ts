import {
  mapContentToReaderPassage,
  mockAdditionalConceptDetails,
  mockConceptDetail,
  mockContentResponse,
  type ReaderPassageViewModel,
  type ReaderTokenViewModel,
} from '@lingua/types';

export type TokenItem = ReaderTokenViewModel;
export type ReaderPassage = ReaderPassageViewModel;
export const defaultReaderPassage = mapContentToReaderPassage(
  mockContentResponse.data,
  [mockConceptDetail, ...mockAdditionalConceptDetails]
);
