# Reader / Content Service MVP — implementation v1

Tài liệu này ghi lại implementation của TASK-008. Chính sách và public contract vẫn thuộc về
`READER_CONTENT_MVP_V1.md`, `contracts/openapi.yaml`, `contracts/enums.json` và
`contracts/errors.json`.

## Ranh giới module

```text
FastAPI routes
  -> ContentApplication / ReaderApplication
    -> PostgreSQL stores
      -> content + sentence + concept catalog authorities
      -> Library saved-state authorities
      -> user_content_progress
      -> Reader exposure source facts
        -> CompetenceEngine / TASK-006D canonical learning_events
```

- Content service chỉ đọc catalog English đã publish và learner overlay. Nó không tạo Today plan,
  không chạy placement và không tính FSRS.
- Reader detail trả annotation gọn gồm concept identity, canonical form, UTF-16 span và
  `ConceptStatus`. Full definition, IPA, example và lexical relations tiếp tục thuộc Dictionary.
- `user_saved_content` / `user_saved_sentences` là Library membership authority.
  `user_content_progress` là resume/completion authority. `exposure_events` và `learning_events` là
  interaction/evidence history. Ba miền này không sao chép hoặc tự động tạo lẫn nhau.

## Publication gate

Migration `0005_reader_content_service_v1` thay trigger yếu trước đây bằng predicate fail-closed
`reader_content_passes_publication_gate(content_id)`. Một item chỉ được Reader đọc khi đồng thời là
English, có curated level A0-B1 phù hợp difficulty, đã review trước publish, có đúng một content
version, 1-100 segment liên tục, metrics khớp cấu trúc, sentence/translation/audio/annotation hợp
lệ, concept aggregate khớp occurrence và mọi dependency provenance có source được approve, quality
score, attribution đầy đủ cùng license `allowed`.

`restricted`, `unknown`, `prohibited`, source thiếu/không approve và attribution không thể biểu diễn
đều bị chặn. Runtime luôn lọc cả `publication_status = 'published'` và predicate trên. Các trigger
immutability ngăn sửa version, segment, metrics, sentence, translation, annotation và audio của nội
dung đang publish; correction phải retire rồi phát hành item mới.

## Content queries

`GET /v1/content/recommended` xác thực owned active English profile, dùng signed opaque keyset cursor
với tuple chính xác `(level distance, known ratio DESC, difficulty, content ID)`, và batch-join known
state, Library state cùng progress. Sort keys PostgreSQL `numeric` được giữ bằng `Decimal` trong
cursor để không mất độ chính xác. Đây là content-fit ordering đã đóng băng, không phải Today
recommendation logic.

`GET /v1/content/{contentId}` dùng ba bounded queries: summary/overlay, ordered segments và toàn bộ
annotation theo batch. Không có N+1 Dictionary hay learner-state query. Unpublished/quarantined IDs
trả product-level 404 và không làm lộ QA/provenance internals.

## Catalog sentence save

`POST /v1/reader/save-sentence` chỉ nhận `sentenceId`. Server tự xác thực câu thuộc một item English
đang publish và actor có active English profile, rồi ghi đúng `user_saved_sentences`. Client không
được gửi `conceptIds`; note vẫn deferred. Same actor/key/body trả exact snapshot; key bị dùng lại cho
payload khác trả `IDEMPOTENCY_KEY_REUSED`.

## Progress authority

`PUT /v1/reader/progress/{contentId}` sở hữu một transaction riêng:

```text
claim actor/key -> validate profile/content/segment -> lock learner/content
-> apply monotonic progress -> store exact result -> commit
```

Server lưu `startedAt`, `lastOpenedAt`, current/furthest segment và immutable `completedAt`.
Back-navigation chỉ đổi current segment. `isCompleted=true` chỉ hợp lệ tại final segment. Percent
được tính theo frozen zero-based rule và bằng 100 chỉ khi complete. Progress không gọi Competence
Engine, không tạo `learning_events` và không tự lưu content vào Library.

## Exposure source fact và TASK-006D fan-out

`POST /v1/reader/exposures` tạo một durable `exposure_events` source fact cho một logical READ,
LISTEN hoặc LOOKUP. READ/LISTEN resolve distinct concept IDs của authoritative segment; LISTEN còn
đòi hỏi catalog audio. LOOKUP phải khớp đúng catalog sentence và UTF-16 range `[startOffset,
endOffset)`, rồi resolve đúng một concept. Client không gửi concept identity.

Một application-owned PostgreSQL transaction thực hiện:

```text
validate owned profile + published hierarchy
-> claim actor/idempotency key
-> persist source fact + exact concept snapshot
-> append one canonical learning_event per distinct concept in UUID order
-> invoke TASK-006D passive projector per child
-> persist exact public result snapshot
-> commit once
```

`reader_exposure_concepts.derivation_key = concept:<uuid>` giữ source-to-child identity ổn định.
Failure ở bất kỳ child nào rollback source, mọi child, projection và snapshot. Passive events chỉ
tăng exposure history/last-seen và có thể chuyển `unseen -> discovered`; competence mass, score,
confidence, mastery, evidence count, mọi status khác và FSRS lineage không đổi.

## Trust boundary

Request DTO đóng băng không mang viewport hoặc playback-percentage telemetry. Vì vậy READ/LISTEN là
client-attested logical eligibility: client chịu trách nhiệm chỉ emit sau frozen traversal/playback
rule. Server không giả vờ chứng minh telemetry mà nó không nhận. Server vẫn tuyệt đối kiểm soát
actor, profile ownership, publication, hierarchy, audio availability, occurrence offsets,
authoritative concept resolution, idempotency, canonical fan-out và projection mutation. Rủi ro MVP
được giới hạn vì passive evidence có competence weight bằng zero.

## Idempotency và concurrency

- Mutation key được khóa bằng PostgreSQL transaction advisory lock theo actor/key; không dùng Python
  process lock.
- Same key/fingerprint trả stored historical snapshot, kể cả khi metadata catalog hợp lệ thay đổi
  sau đó. Same key/different fingerprint bị conflict.
- Progress có thêm actor/content transaction lock để concurrent devices không làm lùi furthest hoặc
  completion.
- Database uniqueness trên source, snapshot fan-out và canonical derivation là hàng rào cuối chống
  duplicate/lost update.

## Seed và phạm vi hoãn

`database/seeds/task008_reader_mvp.sql` là fixture deterministic/idempotent gồm 5 content items, 14
sentences, 30 concepts, 42 occurrences và một audio asset. Nó có A0-A2 published content, B1
unpublished content và restricted/quarantined negative fixture. Mọi prose là LINGUA-authored; không
nhập corpus ngoài.

TASK-008 không triển khai transient Reader Analyze, full Dictionary, Today logic, placement,
AI Tutor, speech scoring, rate-limiter infrastructure hay frontend integration. OpenAPI và frontend
generated artifacts giữ nguyên.
