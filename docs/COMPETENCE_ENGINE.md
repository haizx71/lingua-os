# Competence Engine v1

TASK-006D triển khai chính sách đã khóa trong `LEARNER_EVIDENCE_COMPETENCE_V1.md`. Tài liệu này mô
tả implementation đang chạy; tài liệu policy vẫn là thẩm quyền về ngữ nghĩa.

## Ranh giới và nguồn sự thật

- `learning_events` là lịch sử canonical append-only và là replay authority.
- `user_concept_states` là projection authority cho learner × concept: recognition, listening,
  production, mastery, confidence và ConceptStatus.
- `user_skill_states` chỉ là aggregate recognition/listening/production của toàn language profile;
  Review không dùng các hàng này làm competence của từng concept.
- `fsrs_states` và `review_items` tiếp tục là một lineage Memory/FSRS độc lập cho learner × concept.
  Competence không tính lịch hay ghi FSRS.
- Queue đọc concept projection trong cùng một query. Nếu hàng concept chưa tồn tại hoặc là scalar
  legacy không có parameter lineage, nó trả synthetic zero (`score=0.5`, `confidence=0`,
  `evidenceCount=0`) mà không ghi database.

## Mô hình `competence-beta-v1`

Với prior `Beta(2,2)`, mỗi quan sát có outcome `o` và reliability weight `w`:

```text
positive_mass += w * o
negative_mass += w * (1 - o)
score = (2 + positive_mass) / (4 + positive_mass + negative_mass)
confidence = effective_mass / (effective_mass + 4)
```

Objective correctness có weight `1`; self-recall và rating fallback có weight `0.5`. Rating outcome
lần lượt là Again `0`, Hard `1/3`, Good `2/3`, Easy `1`. Objective `correct` có quyền ưu tiên hơn
rating. Mode mapping: multiple-choice và cloze → recognition; listening → listening; typing và
self-recall → production. Passive exposure không tạo positive/negative mass.

Mastery dùng trọng số word/phrase `0.4/0.3/0.3`, grammar `0.5/0/0.5`; skill chỉ có mastery khi có
policy versioned cụ thể. Runtime resolve mọi policy từ `competence_parameter_sets` theo parameter
lineage của profile; projector không có fallback lexical/grammar hard-code. Mỗi dimension được yêu
cầu phải có effective mass ít nhất `2`, không renormalize các trọng số thiếu. Tám ConceptStatus được
suy ra theo thứ tự ưu tiên:
`forgotten`, `weak`, `mastered`, `active`, `familiar`, `learning`, `discovered`, `unseen`.

## Transaction, idempotency và replay

Review answer chạy trong một PostgreSQL transaction duy nhất:

1. khóa Review item/FSRS state và áp dụng Memory transition;
2. ghi source `review_event`;
3. khóa projection head, ba aggregate skill theo thứ tự cố định, rồi concept state;
4. ghi canonical learning event và cập nhật profile/concept projection;
5. lưu chính xác historical competence snapshot, due count và feedback trên Review event;
6. commit một lần.

Lỗi ở bất kỳ bước nào rollback toàn bộ FSRS, source event, canonical event và projection. Source
event identity tách khỏi canonical identity; `(user_id, source_type, source_event_id,
derivation_key)` ngăn double projection. Profile ingestion sequence cung cấp thứ tự replay ổn định.
Row locks và `state_version` ngăn lost update. Delayed Review replay trả snapshot lịch sử đã lưu,
không lấy projection hiện tại.

Full rebuild khóa projection head, đọc canonical events theo `(ingestion_sequence,
learning_event_id)`, dựng lại aggregate profile và concept projections rồi thay thế chúng trong cùng
transaction. Các review event legacy trước TASK-006D có thể chưa có competence result snapshot;
fallback tương thích của Review trả zero competence thay vì diễn giải scalar legacy thành evidence.

## Phiên bản và phần hoãn

- Migration: `0004_learner_evidence_competence_v1`.
- Method/parameter version: `competence-beta-v1`.
- Parameter set ID: `00000000-0000-4000-8600-000000000002`.
- Reader exposure ingestion hiện chỉ là internal service participant; public Reader endpoint thuộc
  TASK-008 và cần contract review riêng.
- Assessment/Starting Level evidence adapter thuộc TASK-016.
- Không có thuật toán Today, placement, AI Tutor, speech/pronunciation hoặc frontend projection.
