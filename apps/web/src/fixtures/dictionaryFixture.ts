import {
  mapConceptDetailToDictionaryViewModel,
  mockAdditionalConceptDetails,
  mockConceptDetail,
  type DictionaryConceptViewModel,
} from '@lingua/types';

export type DictionaryConceptItem = DictionaryConceptViewModel;
export const defaultDictionaryConcepts: DictionaryConceptItem[] = [
  mapConceptDetailToDictionaryViewModel(mockConceptDetail),
  ...mockAdditionalConceptDetails.map(mapConceptDetailToDictionaryViewModel),
];
