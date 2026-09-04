import {
  mapBrainConceptToViewModel,
  mockAdditionalBrainConceptSummaries,
  mockBrainConceptSummary,
  type BrainConceptViewModel,
} from '@lingua/types';

export type BrainNodeItem = BrainConceptViewModel;
export const defaultBrainNodes: BrainNodeItem[] = [
  mapBrainConceptToViewModel(mockBrainConceptSummary, 'Cuộc hẹn chính thức'),
  ...mockAdditionalBrainConceptSummaries.map((item, index) =>
    mapBrainConceptToViewModel(
      item,
      ['Có sẵn, rảnh rỗi', 'Lịch trình', 'Tiện lợi, thuận tiện', 'Ngập ngừng, do dự', 'Hợp tác, cộng tác'][index]
    )
  ),
];
