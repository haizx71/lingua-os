**TÀI LIỆU 1**

LINGUA OS • Core System Engineering Specification

Kiến trúc, dữ liệu, API, AI, bảo mật, kiểm thử và quy trình triển khai

**Đối tượng bàn giao: ChatGPT Codex / kỹ sư backend / AI agent coding**

Source of Truth v2.0

| **Tên sản phẩm**    | LINGUA OS                                                                                      |
|---------------------|------------------------------------------------------------------------------------------------|
| **Phạm vi bản đầu** | English for Vietnamese, kiến trúc đa ngôn ngữ                                                  |
| **Ngày cập nhật**   | 19/08/2026                                                                                     |
| **Quy tắc**         | Core lớn, MVP nhỏ. Contract trước, code sau. Deferred feature không được đi vào critical path. |

Revision v2.0: Thu hẹp MVP về Today, Reader, Smart Review, Language
Brain và Progress. AI Tutor, pronunciation scoring, realtime forced
alignment và Chinese/Japanese được chuyển sang post-MVP. Memory v1 dùng
một FSRS lineage chính cho mỗi concept/người học. Placement được định
nghĩa là Starting Level Estimate, không phải chứng nhận CEFR. Bổ sung
cost architecture, provider abstraction, content provenance và QA gate.

# 0. Cách sử dụng tài liệu này

Tài liệu này là source of truth cho phần hệ thống cốt lõi. Codex phải
đọc toàn bộ trước khi sửa repository. Mọi quyết định làm thay đổi public
contract, dữ liệu, event, security boundary hoặc hành vi học tập phải
được ghi thành ADR trước khi triển khai.

**Quy tắc cao nhất:** Không suy đoán field, endpoint, trạng thái, thuật
toán hoặc quyền truy cập. Khi thiếu thông tin, ưu tiên giữ contract hiện
tại, tạo TODO có phạm vi rõ ràng và không phá compatibility.

| **Mức** | **Ý nghĩa**      | **Quy tắc**                            |
|---------|------------------|----------------------------------------|
| MUST    | Bắt buộc         | Không đạt thì feature chưa hoàn thành. |
| SHOULD  | Mặc định nên làm | Chỉ lệch khi có ADR giải thích.        |
| MAY     | Tùy chọn         | Không ảnh hưởng contract cốt lõi.      |

# 1. Tuyên ngôn sản phẩm và phạm vi

LINGUA OS là nền tảng học ngôn ngữ thích nghi theo từng người. Lõi là
Learner Language Graph, một mô hình liên tục ghi nhận người học đã gặp
gì, nhớ gì, nhận ra khi đọc/nghe ra sao và có tự sử dụng được hay chưa.
Kiến trúc phải đủ rộng cho speech, AI Tutor và đa ngôn ngữ sau này,
nhưng MVP không phụ thuộc các hệ thống đắt tiền hoặc khó kiểm soát này.

| **Phạm vi**        | **v0.1 MVP**                                                   | **Kiến trúc tương lai**                                                        |
|--------------------|----------------------------------------------------------------|--------------------------------------------------------------------------------|
| Ngôn ngữ học       | English cho người Việt                                         | Chinese, Japanese và ngôn ngữ khác                                             |
| Ngôn ngữ giao diện | Vietnamese                                                     | Đa locale                                                                      |
| Nền tảng           | Web responsive, mobile-first UX                                | Mobile native/hybrid + offline sâu                                             |
| Learning loop      | Today + Reader + Review + Language Brain + Progress            | Tutor, speech coaching, exam, richer recommendation                            |
| Learner dimensions | recognition, listening, production + memory/confidence         | pronunciation, grammar-specific state, phoneme, writing, richer skill evidence |
| AI                 | Không nằm trên critical path; chỉ adapter/contract nếu cần     | AI Tutor, generated lesson, evaluator                                          |
| Speech             | Audio playback/listening evidence; không chấm phát âm realtime | STT, pronunciation analysis, shadowing, local/cloud provider                   |

- Mục tiêu sản phẩm: biến mọi tương tác học thành dữ liệu có cấu trúc để
  cập nhật learner model.

- Mục tiêu kỹ thuật: contract-first, event-aware, observable,
  secure-by-default, multilingual-by-design.

- Mục tiêu MVP: đủ tốt để một người Việt mất gốc đến khoảng B1 học
  English 20–30 phút mỗi ngày bằng Today, Reader, Smart Review, Language
  Brain và Progress; có Starting Level Estimate nhẹ để khởi tạo hồ sơ.

- Không thuộc MVP: AI Tutor tự do, pronunciation scoring, realtime
  forced alignment, Chinese/Japanese mode, exam certification,
  marketplace deck, social feed, live class, payment và multiplayer.

# 2. Chuẩn phát triển bắt buộc

| **Lĩnh vực**   | **Chuẩn / công cụ**           | **Ứng dụng vào LINGUA OS**                                                         |
|----------------|-------------------------------|------------------------------------------------------------------------------------|
| Spec-driven    | GitHub Spec Kit               | Luồng Spec → Plan → Tasks → Implement. Mỗi feature có spec và acceptance criteria. |
| Agent guidance | Codex AGENTS.md + Skills      | Quy tắc bền vững đặt trong repo, không nhồi vào prompt từng task.                  |
| Architecture   | C4 Model + ADR                | C4 cho Context, Container, Component. ADR cho quyết định quan trọng.               |
| HTTP contract  | OpenAPI 3.2                   | Single source of truth cho REST/HTTP API và generated client.                      |
| Event contract | AsyncAPI 3.1                  | Mô tả message-driven contracts và event envelopes.                                 |
| Schema         | JSON Schema 2020-12           | Validation cho event payload, metadata, JSONB.                                     |
| Security       | OWASP ASVS 5.0.0              | Checklist verification cho web/backend.                                            |
| AI security    | OWASP AISVS 1.0               | Threat model và test security cho AI-enabled flows.                                |
| Secure SDLC    | NIST SSDF 1.1                 | Quy trình phát triển an toàn xuyên suốt SDLC.                                      |
| Supply chain   | SLSA                          | Provenance, dependency integrity, build hardening.                                 |
| Observability  | OpenTelemetry                 | Traces, metrics, logs theo chuẩn vendor-neutral.                                   |
| Versioning     | SemVer + Conventional Commits | Quản lý breaking change và changelog tự động.                                      |

# 3. Kiến trúc C4

## 3.1 System Context

Learner  
↓  
Web / Mobile Client  
↓  
API / BFF  
↓  
Platform Core  
├─ PostgreSQL  
├─ Object Storage  
├─ Cache / Queue  
├─ LLM Provider(s) \[optional, post-MVP\]  
└─ Speech Provider(s) \[optional, post-MVP\]

## 3.2 Containers

| Container                            | Trách nhiệm                                             | Công nghệ baseline                  | Không được làm                                       |
|--------------------------------------|---------------------------------------------------------|-------------------------------------|------------------------------------------------------|
| Web App                              | UI, routing, client state, accessibility                | Next.js + React                     | Không chứa business rules lõi                        |
| API / BFF                            | Auth boundary, request validation, response shaping     | Next.js route handlers hoặc FastAPI | Không truy cập DB bằng service-role từ browser       |
| Core API                             | Learner state, content, review, Today, progress         | Python FastAPI                      | Không phụ thuộc trực tiếp UI framework               |
| PostgreSQL                           | Transactional data, Language Brain v1, content metadata | Supabase PostgreSQL                 | Không dùng JSONB thay cho mọi quan hệ có cấu trúc    |
| Worker                               | ETL, async jobs, content enrichment, imports            | Python workers                      | Không expose trực tiếp tới client                    |
| AI Provider Adapter \[post-MVP\]     | Ranh giới tùy chọn cho tutor/model                      | Không deploy trong MVP              | Core không import SDK của provider AI                |
| Speech Provider Adapter \[post-MVP\] | Ranh giới tùy chọn cho STT/pronunciation                | Không deploy trong MVP              | MFA chỉ offline/batch; core không phụ thuộc provider |
| Object Storage                       | Audio, media, import artifacts                          | Supabase Storage hoặc S3-compatible | Không lưu private object bằng public URL mặc định    |
| Cache / Queue                        | Cache ngắn hạn, rate limit, async coordination          | Redis khi cần                       | Không là source of truth                             |

## 3.3 Component boundaries

- Learner Engine: projection của knowledge state, skill state, errors,
  exposures và assessments.

- Memory Engine: review item, FSRS state, due scheduling, review logs.

- Today Engine: ưu tiên review, weakness, goal, content fit và time
  budget.

- Content Engine: content item, segment, sentence, concept occurrence,
  difficulty và licensing.

- Lexical Engine: concept, lexeme, sense, pronunciation, form, relation,
  framework mapping.

- Assessment Engine: placement, adaptive item selection, confidence và
  skill estimates.

- AI Tutor Adapter: post-MVP. Contract/provider boundary cho tutor có
  cấu trúc; core learning không phụ thuộc LLM.

- Speech Provider Boundary: post-MVP cho STT/pronunciation; MVP chỉ cần
  audio asset/playback và listening evidence khi có.

- Recommendation Engine: MVP dùng heuristic có reason code; ML/embedding
  chỉ thêm khi dữ liệu thật chứng minh giá trị.

- Analytics Engine: immutable learning event stream và derived
  aggregates.

## 3.4 Dependency rule cho MVP

PLATFORM CORE  
Identity • Language Data • Learner State • Memory • Content • Events  
↓  
LEARNING INTELLIGENCE  
Today Heuristics • Difficulty • Progress Projection  
↓  
MVP ACTIVITIES  
Reader • Review • Listening exposure • Concept interaction  
↓  
OPTIONAL INTELLIGENCE (feature-gated, post-MVP)  
AI Tutor • STT • Pronunciation • Generated Lessons

Dependency invariant: Platform Core và MVP Activities không import
provider-specific AI/speech SDK. Optional intelligence phải phụ thuộc
vào core contract, không được làm core phụ thuộc ngược lại.

# 4. Repository layout và ownership

/apps  
/web \# Gemini: UI implementation  
/api \# Codex: API/BFF if used  
/services  
/core \# Codex: learner, content, Today, progress  
/worker \# Codex: ETL and async jobs  
/providers  
/ai \# post-MVP; create only after approved spec + feature flag  
/speech \# post-MVP; create only after approved spec + feature flag  
/packages  
/contracts \# generated/shared API types  
/domain \# enums, schemas, domain primitives  
/config \# shared config  
/supabase  
/migrations  
/seed  
/specs  
/openapi  
/asyncapi  
/json-schema  
/docs  
/adr  
/runbooks  
AGENTS.md

Ownership rule: Gemini được sửa /apps/web và /design. Codex được sửa
toàn bộ backend, contracts và infrastructure. Thay đổi
/packages/contracts phải đi qua contract review vì đây là biên giới
chung.

# 5. Naming, identifiers và global conventions

| **Hạng mục**   | **Quy tắc**                                                                 |
|----------------|-----------------------------------------------------------------------------|
| Database       | snake_case, danh từ số nhiều cho table, UUID v7 hoặc UUID chuẩn thống nhất. |
| API JSON       | camelCase ở public API. Mapping nội bộ thực hiện tại boundary.              |
| Events         | domain.entity.action.v1, ví dụ learning.review.completed.v1.                |
| Time           | UTC trong storage. ISO 8601 trong API. Client render theo timezone.         |
| Language       | BCP 47 tags như en, en-US, vi, zh-Hans, zh-Hant, ja.                        |
| Locale data    | Không tự hardcode plural/date/number. Dùng CLDR/Intl.                       |
| Money          | Không thuộc MVP. Nếu thêm sau, integer minor units + ISO 4217.              |
| Soft delete    | Chỉ dùng nơi nghiệp vụ cần phục hồi. Event logs append-only.                |
| Version fields | schemaVersion trên payload/event cần evolve.                                |
| Nullability    | Không dùng null và missing lẫn lộn nếu contract không định nghĩa rõ.        |

# 6. Mô hình dữ liệu ngôn ngữ

Mô hình phải phân biệt concept, hình thức từ, nghĩa và biểu hiện trong
câu. Không dùng một bảng words duy nhất cho mọi ngôn ngữ.

| **Table**              | **Khóa chính / quan hệ** | **Mục đích**                                                               |
|------------------------|--------------------------|----------------------------------------------------------------------------|
| languages              | code                     | Ngôn ngữ cơ sở.                                                            |
| scripts                | code                     | Latin, Hans, Hant, Jpan và script khác.                                    |
| proficiency_frameworks | id                       | CEFR, HSK, JLPT, custom.                                                   |
| proficiency_levels     | id, framework_id         | A1..C2, HSK levels, JLPT N5..N1.                                           |
| concepts               | id, language_code        | Đơn vị tri thức: word concept, phrase, grammar, phoneme, character, skill. |
| lexemes                | id, concept_id           | Lemma/lexical form theo language.                                          |
| lexeme_forms           | id, lexeme_id            | went, gone, plurals, conjugations.                                         |
| word_senses            | id, lexeme_id            | Nghĩa tách biệt, definition, translation.                                  |
| pronunciations         | id, lexeme_id            | IPA, accent, audio ref, source.                                            |
| concept_relations      | source_id,target_id      | synonym, antonym, prerequisite, family, topic.                             |
| framework_mappings     | concept_id, level_id     | Map concept tới CEFR/HSK/JLPT.                                             |
| topics                 | id                       | Travel, food, work, daily life.                                            |
| concept_topics         | concept_id,topic_id      | Many-to-many.                                                              |
| data_sources           | id                       | Nguồn, license, attribution, version.                                      |
| source_records         | id,source_id             | Provenance của imported record.                                            |

**Data provenance:** Mỗi dữ liệu import phải truy được về source,
version, license, import timestamp và transformation. Không đưa dataset
chưa rõ quyền sử dụng vào production.

# 7. Sentence, content và corpus model

| **Table**             | **Các field chính**                                                 | **Ghi chú**                                   |
|-----------------------|---------------------------------------------------------------------|-----------------------------------------------|
| sentences             | id, language_code, text, normalized_text, difficulty, quality_score | Atomic sentence.                              |
| sentence_translations | sentence_id, target_language, text, source_id                       | Một câu có nhiều bản dịch.                    |
| sentence_concepts     | sentence_id, concept_id, start_offset, end_offset, role             | Cho content fit và highlighting.              |
| audio_assets          | id, uri, language, speaker_meta, duration_ms, license               | Không lưu URL tạm thời.                       |
| sentence_audio        | sentence_id, audio_id, start_ms, end_ms                             | Audio clip mapping.                           |
| content_items         | id, type, language, title, difficulty, status, source_id            | Story, article, dialogue, lesson, transcript. |
| content_segments      | id, content_id, order_index, text, audio range                      | Đơn vị hiển thị và học.                       |
| content_concepts      | content_id, concept_id, occurrence_count                            | Precomputed fit.                              |
| content_metrics       | content_id, token_count, knownness priors, lexical diversity        | Dùng recommendation.                          |
| content_versions      | content_id, version, hash                                           | Không sửa nội dung đã học mà mất lịch sử.     |

# 8. Learner Language Graph

Learner state là projection có thể tái tính từ learning events và
assessments. MVP chỉ theo dõi các chiều tạo giá trị trực tiếp cho
Reader/Review/Today: recognition, listening và production.
Pronunciation, phoneme, grammar-specific state và writing là extension
points, không phải cột bắt buộc ngay từ đầu. Không xem một score duy
nhất là sự thật tuyệt đối.

| **Table**           | **Vai trò**                         | **Các field bắt buộc ở MVP**                                                                         |
|---------------------|-------------------------------------|------------------------------------------------------------------------------------------------------|
| user_languages      | Một hồ sơ cho mỗi ngôn ngữ học      | user_id, language_code, goal, current_level_estimate?, target_level?, daily_minutes, status          |
| user_skill_states   | Ước lượng skill-level có confidence | skill, score, confidence, evidence_count, assessed_at, method_version                                |
| user_concept_states | Language Brain v1 theo concept      | recognition, listening, production, mastery, confidence, exposure_count, last_seen_at, state_version |
| learning_events     | Evidence log append-only            | type, user_id, concept_id?, content_id?, activity_id?, payload, occurred_at, schema_version          |
| assessment_results  | Starting Level Estimate             | estimate, confidence, evidence_count, method_version, framework_mapping?                             |
| future_extensions   | Không tạo table sớm nếu chưa dùng   | pronunciation/phoneme/error/writing state chỉ thêm bằng migration + ADR khi feature được bật         |

mastery is a derived projection, not a raw fact.  
MVP lexical default:  
recognition 0.40  
listening 0.30  
production 0.30  
  
Only include dimensions with enough evidence. Confidence is tracked
separately from mastery.  
Weights MUST be versioned and vary by concept type.  
Do not expose mastery as a certified language level.

# 9. Memory Engine và FSRS v1

MVP dùng một memory lineage chính cho mỗi user + concept. Các exercise
mode như recognition, listening, cloze và production tạo evidence khác
nhau nhưng mặc định cập nhật cùng một FSRS schedule. Không tạo nhiều
scheduler song song cho từng modality khi chưa có dữ liệu chứng minh lợi
ích, vì điều này làm queue phình và khó giải thích.

| **Table**              | **Field**                                                                              | **Quy tắc MVP**                                                                       |
|------------------------|----------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| review_items           | id,user_id,concept_id,status,created_from                                              | Một active primary review item cho mỗi user + concept, trừ khi ADR cho phép ngoại lệ. |
| fsrs_states            | review_item_id,difficulty,stability,due_at,last_review_at,state,params_version         | Scheduler state độc lập với mastery projection.                                       |
| review_events          | review_item_id,exercise_mode,rating,response_time_ms,correct,evidence_json,reviewed_at | Append-only; exercise_mode không tạo schedule mới mặc định.                           |
| fsrs_parameter_sets    | scope,version,parameters,trained_at?                                                   | MVP dùng bộ tham số versioned; optimizer cá nhân là post-MVP.                         |
| review_queue_snapshots | user_id,date,item_ids,reason_codes,engine_version                                      | Chỉ bật nếu cần debug/reproducibility; có retention policy.                           |

- Again, Hard, Good, Easy là feedback cho scheduler, không đồng nghĩa
  correct/incorrect tuyệt đối.

- Review item tạo mới khi concept được learner chủ động lưu hoặc đủ
  evidence cho thấy concept cần đi vào active learning.

- Không reset history khi đổi prompt template. Version prompt và
  preserve review lineage.

- Time zone chỉ ảnh hưởng daily boundary. due_at vẫn lưu UTC.

Không tách recognition/listening/production thành ba due date độc lập
trong MVP. Nếu sau này tách scheduler, phải có experiment, queue-size
analysis, migration plan và ADR riêng.

# 10. Today Engine

Today Engine chọn next best set of activities trong time budget. Nó
không tạo một playlist ngẫu nhiên.

candidateScore =  
overdueUrgency  
+ weaknessPriority  
+ goalRelevance  
+ recentExposure  
+ contentRelevance  
- fatiguePenalty  
- repetitionPenalty  
  
MVP constraints:  
1. Protect due reviews.  
2. Respect dailyMinutes and a fixed new-concept budget.  
3. Reduce new concepts when recent retention drops.  
4. Prefer content with high known-concept ratio but enough useful
novelty.  
5. Do not require ML, embeddings or LLM to generate a plan.  
6. Record human-readable reason codes and engineVersion for every
selected activity.

| **Reason code**         | **Ví dụ**                                      |
|-------------------------|------------------------------------------------|
| FSRS_DUE                | Concept đến hạn ôn.                            |
| WEAK_RECOGNITION        | Nhìn từ/cụm từ còn thiếu ổn định.              |
| WEAK_LISTENING          | Đã biết khi đọc nhưng nghe nhận ra kém.        |
| LOW_PRODUCTION_EVIDENCE | Ít evidence tự nhớ/tự dùng concept.            |
| CONTENT_FIT             | Bài đọc có tỷ lệ concept quen thuộc phù hợp.   |
| RECENT_EXPOSURE         | Concept vừa gặp trong Reader, nên củng cố sớm. |
| NEW_CONCEPT_BUDGET      | Hôm nay còn ngân sách thêm concept mới.        |

# 11. Starting Level Estimate và Assessment Engine

- MVP dùng heuristic adaptive estimate, không tuyên bố là bài thi chuẩn
  hóa hay chứng nhận CEFR. Mỗi item phải có skill target, concept tags,
  difficulty prior và method/version metadata.

- Adaptive selection ưu tiên item gần vùng năng lực ước lượng hiện tại.
  Information gain/IRT là hướng nâng cấp khi có đủ dữ liệu hiệu chỉnh
  thực nghiệm, không là dependency để ship MVP.

- Dừng khi đạt confidence threshold hoặc max item budget.

- Không suy ra speaking chỉ từ grammar/vocabulary quiz.

- Kết quả gồm estimate, confidence, evidence count, assessed skills,
  methodVersion và framework mapping tham khảo. UI phải dùng nhãn “ước
  lượng khởi điểm” khi độ tin cậy chưa cao.

| **Table**             | **Mục đích**                                                                   |
|-----------------------|--------------------------------------------------------------------------------|
| assessment_templates  | Cấu trúc Starting Level Estimate/diagnostic.                                   |
| assessment_items      | Question, answer schema, skill/concept tags, difficulty prior, source/version. |
| assessment_attempts   | Session, status, adaptive state, method_version.                               |
| assessment_responses  | Answer, correctness, latency, evidence.                                        |
| assessment_results    | Estimate, confidence, evidence_count, assessed_skills, framework_mapping.      |
| assessment_item_stats | Post-MVP: empirical difficulty/discrimination khi có đủ sample.                |

Calibration rule: Sau onboarding, learner estimate tiếp tục được cập
nhật từ hành vi học thật. Initial placement không được trở thành single
point of failure cho recommendation.

# 12. AI Tutor Adapter, post-MVP

AI Tutor không thuộc MVP và không được nằm trên critical path của Today,
Reader, Review hay Language Brain. Kiến trúc chỉ giữ provider-neutral
contract để sau này thêm LLM mà không sửa core. Khi feature chưa bật,
không tạo endpoint public, background job hay bảng dữ liệu chỉ để “chuẩn
bị trước”.

| **Khối**                | **Yêu cầu khi feature được bật**                                                                  |
|-------------------------|---------------------------------------------------------------------------------------------------|
| Provider abstraction    | Domain contract không chứa tên/model-specific field của OpenAI, Gemini, Claude hay provider khác. |
| Tutor policy            | Giữ level phù hợp, ưu tiên target concepts, không sửa mọi lỗi cùng lúc.                           |
| Structured output       | Schema validation trước khi ghi learner evidence. Prose không được tự động thành fact.            |
| Prompt/model versioning | Lưu promptVersion, modelRoute, policyVersion và checksum khi cần audit.                           |
| Cost control            | Per-user quota, max turns, token budget, timeout, caching khi phù hợp.                            |
| Evaluation              | Golden set + regression trước khi đổi prompt/model ở production.                                  |
| Safety/privacy          | Data minimization, input/output controls và không gửi dữ liệu thừa cho provider.                  |
| Fallback                | LLM unavailable không làm hỏng core learning flow.                                                |

\# FUTURE CONTRACT, do not migrate/create until feature flag is
approved  
ai_tutor_session  
id  
user_language_id  
scenario_id  
target_concept_ids\[\]  
prompt_version  
model_route  
status  
  
ai_tutor_turn  
session_id  
turn_index  
user_text  
assistant_text  
structured_feedback_json  
usage_json  
latency_ms  
created_at

# 13. Speech Provider Architecture, post-MVP

MVP: content audio playback → listening interaction → learner
evidence.  
  
Future realtime path: recording → validation/VAD →
SpeechProvider.transcribe() → confidence-aware evidence → optional
lightweight pronunciation analysis.  
  
Offline/batch path: curated audio + transcript → forced alignment
tooling such as MFA → dataset QA/enrichment.  
  
Do not place Montreal Forced Aligner on the mobile realtime request
path.

| **Stage**              | **Output**                                  | **MVP / future rule**                                    |
|------------------------|---------------------------------------------|----------------------------------------------------------|
| Audio asset            | url/duration/license/source                 | MVP. Playback must work without speech service.          |
| Recording validation   | codec,duration,size,sample rate             | Future. Reject invalid media before provider call.       |
| STT provider           | transcript + confidence + provider metadata | Future. Local/cloud implementation behind one interface. |
| Pronunciation evidence | word/phoneme signals + confidence           | Future. Never overclaim low-confidence scoring.          |
| Forced alignment       | word/phoneme timings                        | Offline/batch dataset processing, not realtime MVP.      |
| Learner update         | validated learning event                    | Idempotent; provider output remains untrusted evidence.  |

# 14. Content ingestion và ETL

Acquire → License check → Raw immutable snapshot → Parse → Normalize →
Language detection/tokenize → Deduplicate → Safety/quality filter →
Difficulty score → Concept link → Automated QA → Review status → Publish

| **Trạng thái content** | **Ý nghĩa**                         |
|------------------------|-------------------------------------|
| raw                    | Vừa nhập.                           |
| normalized             | Đã chuẩn hóa.                       |
| enriched               | Đã gắn concept/metrics.             |
| reviewed               | Đạt QA.                             |
| published              | Cho learner sử dụng.                |
| quarantined            | License/quality/safety issue.       |
| retired                | Không đề xuất mới, vẫn giữ history. |

- Mọi importer idempotent theo source_record key/hash.

- Raw snapshot immutable để tái xử lý khi parser thay đổi.

- Không overwrite source text khi normalize. Lưu normalized riêng.

- License policy chạy trước publish. License của extraction tool/library
  không được suy diễn thành license của dữ liệu được extract.

- Quality score phải giải thích được bằng reason codes.

## 14.1 Provenance record bắt buộc

Mỗi lexical/content/audio record có nguồn ngoài phải truy được tối
thiểu: source_id, source_record_id, source_url_or_dataset,
source_version, license_id, attribution_text_or_rule, imported_at,
raw_hash, transform_version, quality_score, review_status. Nếu quyền sử
dụng chưa rõ, record ở quarantined và không xuất hiện cho learner.

| **QA gate**  | **Điều kiện publish**                                                      |
|--------------|----------------------------------------------------------------------------|
| License      | Có policy phù hợp với use case và attribution được lưu.                    |
| Language     | Language/script detection hợp lệ; normalization không phá source text.     |
| Duplicate    | Không trùng hoặc near-duplicate vượt policy.                               |
| Quality      | Không có lỗi cấu trúc rõ, translation/definition hợp lệ theo source class. |
| Safety       | Loại/quarantine nội dung không phù hợp với đối tượng hoặc policy.          |
| Difficulty   | Có explainable difficulty features hoặc fallback.                          |
| Traceability | Có raw_hash + transform_version để tái tạo pipeline.                       |

# 15. API contract

OpenAPI 3.2 là source of truth. Client SDK sinh từ contract. Không viết
tay hai bộ type backend/frontend.

Success envelope where needed:  
{  
"data": {...},  
"meta": {"requestId": "..."}  
}  
  
Error envelope:  
{  
"error": {  
"code": "LEARNING_PLAN_NOT_FOUND",  
"message": "...",  
"details": {},  
"requestId": "..."  
}  
}

| **Domain**     | **Endpoint baseline / trạng thái**                                      |
|----------------|-------------------------------------------------------------------------|
| Auth/Profile   | \[MVP\] GET /v1/me, PATCH /v1/me                                        |
| Languages      | \[MVP\] GET/POST /v1/me/languages, PATCH /v1/me/languages/{id}          |
| Today          | \[MVP\] GET /v1/today, POST /v1/today/{planId}/activities/{id}/complete |
| Review         | \[MVP\] GET /v1/review/queue, POST /v1/review/{itemId}/answer           |
| Concepts       | \[MVP\] GET /v1/concepts/{id}, GET /v1/dictionary/search                |
| Reader         | \[MVP\] POST /v1/reader/analyze, POST /v1/reader/save-sentence          |
| Content        | \[MVP\] GET /v1/content/recommended, GET /v1/content/{id}               |
| Assessment     | \[MVP\] POST /v1/assessments, POST /v1/assessments/{id}/responses       |
| Progress/Brain | \[MVP\] GET /v1/progress/overview, GET /v1/brain/concepts/{conceptId}   |
| Tutor          | \[DEFERRED\] Không publish endpoint trước feature approval.             |
| Speech         | \[DEFERRED\] Không publish endpoint trước feature approval.             |

- Idempotency-Key bắt buộc cho write dễ retry như review submission,
  assessment response và Today activity completion. Future audio
  processing chỉ áp dụng khi Speech feature được bật.

- Cursor pagination cho collection lớn.

- ETag hoặc version cho resource có concurrent edits.

- Không trả database row nguyên xi. API DTO là lớp riêng.

- Breaking change phải tăng major API hoặc có migration path.

# 16. Event contract

AsyncAPI 3.1 mô tả event. Event envelope versioned và immutable.

{  
"eventId": "uuid",  
"eventType": "learning.review.completed.v1",  
"schemaVersion": 1,  
"occurredAt": "2026-08-19T13:00:00Z",  
"actorId": "uuid",  
"correlationId": "uuid",  
"causationId": "uuid\|null",  
"payload": {...}  
}

| **Event**                     | **Consumer chính**                                                                    |
|-------------------------------|---------------------------------------------------------------------------------------|
| learning.review.completed.v1  | Memory Engine, Learner projection, Analytics                                          |
| learning.exposure.recorded.v1 | Learner projection, Progress                                                          |
| learning.concept.saved.v1     | Review activation, Learner projection                                                 |
| assessment.completed.v1       | Skill projection, Today Engine                                                        |
| content.enriched.v1           | Reader/Recommendation index                                                           |
| today.activity.completed.v1   | Learner projection, Analytics                                                         |
| future.\*                     | AI/speech events chỉ thêm khi feature tương ứng được phê duyệt và contract versioned. |

# 17. Database security, Auth và RLS

| **Rule**          | **Implementation**                                          |
|-------------------|-------------------------------------------------------------|
| Default deny      | RLS bật cho mọi user-owned table exposed qua Supabase.      |
| Ownership         | user_id được lấy từ auth context, không tin payload client. |
| Service role      | Chỉ server-side secret store. Không bundle vào web.         |
| Admin path        | Tách role/permission và audit.                              |
| Sensitive columns | Không expose qua public view nếu không cần.                 |
| Views             | Kiểm tra security_invoker/security_barrier phù hợp.         |
| Storage           | Bucket policy theo owner và content class.                  |
| Audit             | Security-sensitive mutation ghi audit event.                |

**RLS test gate:** Mỗi migration thêm user-owned table phải kèm policy
test: own row allowed, other user denied, anonymous denied nếu không có
lý do công khai.

# 18. Security và threat model

| **Threat**              | **Control tối thiểu**                                                                |
|-------------------------|--------------------------------------------------------------------------------------|
| Broken access control   | RLS, server authz, ownership tests, deny by default.                                 |
| Injection               | Parameterized queries, schema validation, output encoding.                           |
| Prompt injection        | Treat retrieved/user content as untrusted data, tool allowlist, no secret in prompt. |
| Model output abuse      | Structured schema, validation, policy filters, never execute raw model output.       |
| SSRF                    | Outbound allowlist và URL validation cho importer.                                   |
| Malicious file          | Size/type validation, isolated processing.                                           |
| Data poisoning          | Source provenance, checksum, quarantine, approval states.                            |
| Dependency compromise   | Lockfiles, provenance, dependency scanning, SLSA-aligned build.                      |
| Replay/duplicate writes | Idempotency keys and unique constraints.                                             |
| Sensitive logging       | PII redaction, secret scrub, structured logs.                                        |

Security verification baseline: OWASP ASVS 5.0.0 cho application
controls, OWASP AISVS 1.0 cho AI-enabled paths, NIST SSDF cho secure
lifecycle. Mọi release candidate chạy security checklist và threat
review.

# 19. Privacy và dữ liệu người học

- Thu thập tối thiểu. Tách identity data khỏi learning telemetry khi hợp
  lý.

- Audio có retention policy riêng. Cho xóa audio mà vẫn giữ aggregate
  score nếu policy cho phép.

- Export dữ liệu người dùng ở định dạng machine-readable.

- Delete account dùng asynchronous deletion workflow, audit được trạng
  thái.

- Không log raw access token, password, full audio transcript nếu không
  cần debug.

- Prompt gửi model chỉ chứa context cần cho turn hiện tại, không dump
  toàn bộ learner history.

# 20. Observability

| **Signal**      | **Yêu cầu**                                                                       |
|-----------------|-----------------------------------------------------------------------------------|
| Trace           | requestId, user-safe actor id, service, endpoint, dependency spans.               |
| Metric          | latency p50/p95/p99, error rate, queue lag, model latency/cost, STT latency.      |
| Log             | Structured JSON, severity, traceId, no secrets.                                   |
| Business metric | review completion, plan completion, retention estimate, content fit distribution. |
| AI metric       | schema failure, fallback rate, unsafe response rate, prompt version performance.  |

- Dùng OpenTelemetry semantic conventions nơi phù hợp.

- Dashboard tách system health khỏi learning analytics.

- Alert dựa trên SLO, không alert theo mọi error đơn lẻ.

- Mọi external call có timeout, retry policy và circuit/fallback logic
  rõ.

# 21. Reliability và performance budgets

| **Hạng mục**               | **Target MVP**                                                      |
|----------------------------|---------------------------------------------------------------------|
| Read API p95               | \< 400 ms cho DB/cache path thông thường.                           |
| Write API p95              | \< 600 ms cho synchronous learner writes thông thường.              |
| Today plan load            | \< 800 ms cache miss ở dữ liệu bình thường.                         |
| Reader concept lookup      | \< 250 ms p95 sau khi content đã được pre-enrich/cache phù hợp.     |
| Availability target        | 99.5% cho public beta.                                              |
| Data durability            | DB backup + tested restore procedure.                               |
| Idempotent critical writes | Review, assessment response, plan/activity completion, import jobs. |
| External AI/speech         | Không nằm trong MVP SLO vì không nằm trên critical path.            |

## 21.1 Cost architecture và provider abstraction

MVP phải có baseline infra rẻ và predictable. Mọi dịch vụ có biến phí
theo request/token/audio minute phải nằm sau interface, quota và feature
flag. Không dùng LLM, vector search hoặc speech inference cho công việc
có thể giải bằng SQL, precomputation hoặc heuristic rõ ràng.

| **Subsystem**      | **MVP**                            | **Cost guardrail**              | **Future adapter**                               |
|--------------------|------------------------------------|---------------------------------|--------------------------------------------------|
| Today              | SQL + deterministic heuristic      | Không LLM/embedding per request | Recommendation model                             |
| Reader difficulty  | Precomputed concept ratio/features | Cache/enrich khi ingest         | Richer semantic ranking                          |
| Dictionary/content | Postgres + indexed lookup          | Không vector search mặc định    | pgvector nếu experiment chứng minh giá trị       |
| AI Tutor           | Disabled                           | No token spend                  | LLMProvider + quota/budget                       |
| Speech             | Playback only                      | No inference spend              | SpeechProvider local/cloud                       |
| Graph              | Postgres relations                 | Không vận hành Neo4j sớm        | Graph DB chỉ khi benchmark/use case buộc phải có |

# 22. Testing strategy

| **Layer**          | **Công cụ gợi ý**                      | **Bắt buộc test**                                                                |
|--------------------|----------------------------------------|----------------------------------------------------------------------------------|
| Domain unit        | Pytest/Vitest                          | Learner projection, Today heuristics, review state machines.                     |
| Property/invariant | Hypothesis/fast-check                  | Bounds, deterministic normalization, idempotency, replay safety.                 |
| DB                 | Postgres test DB                       | Migrations, constraints, indexes, RLS.                                           |
| Contract           | OpenAPI + generated client             | Request/response compatibility và mock validation.                               |
| Content QA         | ETL fixtures/golden records            | License gate, provenance, dedupe, normalization, publish/quarantine transitions. |
| Integration        | Testcontainers/local stack             | DB + job/outbox + API boundaries.                                                |
| Assessment         | Golden item set                        | Estimate stability, confidence behavior, no false certification claim.           |
| E2E                | Playwright                             | Onboarding → Today → Review → Reader → Brain/Progress.                           |
| Future AI/speech   | Provider contract + eval fixtures      | Chỉ thành release gate khi feature được bật.                                     |
| Security           | ASVS/AISVS where applicable + scanners | Access control, injection, file/provider boundaries.                             |

**Release gate:** Không merge feature nếu acceptance criteria chưa có
test hoặc lý do rõ tại spec. Snapshot không thay thế behavioral
assertions.

# 23. CI/CD và supply chain

1.  Lint + formatting + typecheck.

2.  Unit and property tests.

3.  Schema/OpenAPI/AsyncAPI validation.

4.  Database migration dry-run và RLS tests.

5.  Build web/API/worker images.

6.  Dependency and secret scan.

7.  Integration tests.

8.  AI/speech regression suite chỉ chạy khi feature flag/provider tương
    ứng được bật; không là dependency của MVP branch.

9.  Generate SBOM/provenance khi pipeline hỗ trợ.

10. Deploy staging, smoke test, sau đó production với rollback strategy.

- Migrations forward-compatible khi deploy rolling.

- Không deploy schema breaking trước client compatibility window.

- Feature flags cho feature có rủi ro cao.

- Conventional Commits và SemVer cho packages/contracts.

# 24. ADR bắt buộc trước khi code

| **ADR** | **Câu hỏi phải chốt**                                                                       |
|---------|---------------------------------------------------------------------------------------------|
| ADR-001 | Monorepo và package manager.                                                                |
| ADR-002 | API Gateway/BFF vs direct service access.                                                   |
| ADR-003 | Event transport cho MVP: DB outbox, queue hay broker.                                       |
| ADR-004 | FSRS implementation, parameter versioning và one-primary-memory-lineage policy.             |
| ADR-005 | AI provider abstraction, feature gating, quota và structured output khi post-MVP bật Tutor. |
| ADR-006 | SpeechProvider local/cloud và nguyên tắc MFA chỉ dùng offline/batch.                        |
| ADR-007 | Postgres relation graph là mặc định; tiêu chí benchmark trước khi thêm Neo4j/graph DB.      |
| ADR-008 | User learning event retention, deletion/export và privacy model.                            |
| ADR-009 | Content licensing, attribution, provenance và quarantine policy.                            |
| ADR-010 | Cost budgets, usage metering và paid-feature boundary cho AI/speech.                        |
| ADR-011 | Starting Level Estimate methodology, confidence và wording; không certification.            |
| ADR-012 | Vector search/embedding chỉ thêm sau experiment và lifecycle/cost plan.                     |
| ADR-013 | Mobile strategy sau web MVP.                                                                |

# 25. Contract giữa Codex và Gemini

Hai agent làm song song chỉ khi các artifact dưới đây tồn tại và được
version-control.

| **Artifact**                        | **Owner**         | **Consumer**             | **Rule**                                |
|-------------------------------------|-------------------|--------------------------|-----------------------------------------|
| /packages/contracts/openapi.yaml    | Codex             | Gemini                   | Frontend không gọi endpoint ngoài spec. |
| /packages/contracts/asyncapi.yaml   | Codex             | Gemini nếu dùng realtime | Không tự đặt event name.                |
| /packages/contracts/schemas/\*.json | Codex             | Gemini                   | Mock và validation dùng chung.          |
| /packages/sdk                       | Generated         | Gemini                   | Không sửa tay generated code.           |
| /mocks                              | Codex từ contract | Gemini                   | UI phát triển độc lập backend.          |
| /design/tokens/tokens.json          | Gemini            | Codex/web build          | Không hardcode token trùng lặp.         |
| /docs/product/domain-glossary.md    | Shared            | Cả hai                   | Tên domain phải thống nhất.             |
| /docs/product/ui-state-matrix.md    | Gemini            | Codex                    | Backend phải cung cấp state cần thiết.  |
| /docs/adr                           | Codex/shared      | Cả hai                   | Decision history không mất.             |

# 26. Definition of Done cho backend feature

- Spec có user story, acceptance criteria, edge cases và non-goals.

- Public contract cập nhật trước implementation.

- Migration có rollback/recovery plan và RLS test.

- Business rule có unit test.

- Critical path có integration/contract test.

- Telemetry có request/correlation ids và metric cần thiết.

- Security checklist cập nhật nếu attack surface thay đổi.

- Error code/documentation đủ cho frontend.

- Mock fixture được sinh/cập nhật cho Gemini.

- ADR được thêm nếu quyết định kiến trúc thay đổi.

- No secret, no debug dump, no dead experimental code trong main branch.

# 27. Implementation roadmap cho Codex

| **Phase**                      | **Deliverable**                                                           | **Exit criteria**                                                              |
|--------------------------------|---------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| P0 Foundations                 | Repo, AGENTS.md, Spec Kit, CI, contracts skeleton, local env              | Fresh clone chạy tests/dev stack; MVP/deferred flags documented.               |
| P1 Identity + Language Profile | users, user_languages, auth, RLS                                          | Isolation tests pass; goals/daily time persisted.                              |
| P2 Language Data + Provenance  | concept, lexeme, sense, sentence, content, source/license/import pipeline | Seed content search/detail works; quarantine/publish gate tested.              |
| P3 Language Brain v1           | learning_events + user_concept_states + projection versioning             | Recognition/listening/production update replay-safe.                           |
| P4 Smart Review                | one primary review item/concept, FSRS, queue, review events               | Deterministic due schedule; exercise modes share lineage.                      |
| P5 Reader                      | content detail, concept linking, save concept/sentence, exposure events   | Reading loop updates Language Brain and review path.                           |
| P6 Today Engine                | heuristic plan + reason codes + time/new-concept budget                   | No AI dependency; plan reproducible by engineVersion.                          |
| P7 Brain + Progress API        | overview, concept detail, trends/confidence                               | Frontend can visibly demonstrate personalization after first week.             |
| P8 Starting Level Estimate     | light adaptive assessment + confidence/method version                     | No certification wording; estimate feeds initial plan and self-corrects later. |
| P9 Beta Hardening              | Observability, content QA, security, load, backup/restore, cost telemetry | MVP release checklist pass.                                                    |
| POST-A                         | AI Tutor adapter + eval + quota                                           | Only after product/retention evidence and cost budget approval.                |
| POST-B                         | Speech/STT/pronunciation provider                                         | Only after UX need, privacy and latency/cost targets are approved.             |
| POST-C                         | Chinese/Japanese language-specific engines                                | Only after English learning loop is validated.                                 |

# 28. AGENTS.md baseline cho Codex

\# LINGUA OS engineering rules  
1. Read /docs/product, /docs/architecture, /docs/adr and
/packages/contracts before implementation.  
2. Follow Spec -\> Plan -\> Tasks -\> Implement.  
3. Treat v0.1 MVP boundary as a hard constraint. Do not implement
deferred Tutor/Speech/CJK features unless an approved spec + flag
exists.  
4. Do not invent public fields or endpoints. Change contracts first.  
5. Platform Core must not import provider-specific AI/speech SDKs.  
6. PostgreSQL is the default graph/storage layer. Do not add
Neo4j/vector infrastructure without benchmark + ADR.  
7. MVP memory uses one primary FSRS lineage per user + concept. Do not
create modality-specific due queues without ADR.  
8. Every external data record needs provenance/license handling before
publish.  
9. Every user-owned table requires RLS and tests.  
10. Every critical write is idempotent or explicitly documented as
non-idempotent.  
11. Domain logic stays out of HTTP handlers and UI.  
12. AI/provider output is untrusted evidence. Validate before
persistence or learner-state mutation.  
13. Add tests for behavior, failure paths, authorization and
migration/replay safety.  
14. Run lint, typecheck, unit, contract, DB and integration tests before
completing a task.  
15. Update mocks and documentation when contract behavior changes.  
16. Never commit secrets, production data or unlicensed content.

# 29. Checklist nghiệm thu toàn hệ thống

| **Nhóm**                  | **Câu hỏi pass/fail**                                                                               |
|---------------------------|-----------------------------------------------------------------------------------------------------|
| MVP boundary              | Feature có thuộc v0.1 không? Deferred feature có bị kéo vào critical path hoặc nav/API không?       |
| Contract                  | OpenAPI/AsyncAPI validate? Generated SDK current? No undocumented endpoint/event?                   |
| Data                      | Constraints, indexes, versioning và migration path đủ?                                              |
| Provenance                | Nguồn, version, license, attribution, raw hash, transform version và QA status truy được?           |
| Language Brain            | Recognition/listening/production cập nhật từ evidence và replay-safe? Confidence tách khỏi mastery? |
| Memory                    | Một primary FSRS lineage/concept? Review history không mất khi prompt/exercise thay đổi?            |
| Today                     | Heuristic có reason code, time budget, new-concept budget và không phụ thuộc AI?                    |
| Placement                 | Chỉ gọi Starting Level Estimate? Confidence/methodVersion rõ? Không overclaim CEFR?                 |
| Cost                      | External variable-cost service có provider interface, quota, telemetry và feature flag chưa?        |
| AI/Speech                 | Nếu disabled: không phát sinh runtime dependency. Nếu enabled: schema/eval/confidence/privacy pass? |
| Security/Privacy          | RLS, authz, retention/delete/export, file/provider boundary pass?                                   |
| Observability/Reliability | Trace, metric, timeout, retry, idempotency, backup/restore đủ?                                      |
| Testing/Handoff           | Critical journey tests pass và Gemini nhận mock/type/UI states đúng contract?                       |

# Nguồn chuẩn và tài liệu tham chiếu

**R1. OpenAI Codex Best Practices.** OpenAI. Dùng AGENTS.md, context bền
vững, validation và workflow. [<u>Nguồn chính
thức</u>](https://developers.openai.com/codex/learn/best-practices)

**R2. GitHub Spec Kit.** GitHub. Spec-driven workflow: Spec, Plan,
Tasks, Implement. [<u>Nguồn chính
thức</u>](https://github.github.com/spec-kit/)

**R3. C4 Model.** c4model.com. Mô hình kiến trúc phân cấp cho system,
container, component. [<u>Nguồn chính thức</u>](https://c4model.com/)

**R4. OpenAPI Specification 3.2.0.** OpenAPI Initiative. Chuẩn mô tả
HTTP API. [<u>Nguồn chính
thức</u>](https://spec.openapis.org/oas/v3.2.0.html)

**R5. AsyncAPI Specification 3.1.0.** AsyncAPI Initiative. Chuẩn
message-driven API. [<u>Nguồn chính
thức</u>](https://www.asyncapi.com/docs/reference/specification/v3.1.0)

**R6. JSON Schema 2020-12.** JSON Schema. Validation cho JSON contracts.
[<u>Nguồn chính thức</u>](https://json-schema.org/draft/2020-12)

**R7. OWASP ASVS 5.0.0.** OWASP. Verification requirements cho
application security. [<u>Nguồn chính
thức</u>](https://owasp.org/www-project-application-security-verification-standard/)

**R8. OWASP AISVS 1.0.** OWASP. Requirements cho AI-enabled systems.
[<u>Nguồn chính
thức</u>](https://owasp.org/www-project-artificial-intelligence-security-verification-standard-aisvs-docs/)

**R9. NIST SP 800-218 SSDF 1.1.** NIST. Secure software development
practices. [<u>Nguồn chính
thức</u>](https://csrc.nist.gov/pubs/sp/800/218/final)

**R10. OpenTelemetry.** CNCF. Vendor-neutral traces, metrics, logs.
[<u>Nguồn chính thức</u>](https://opentelemetry.io/docs/)

**R11. PostgreSQL Row Security.** PostgreSQL. Row-level authorization
primitive. [<u>Nguồn chính
thức</u>](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

**R12. Supabase Row Level Security.** Supabase. RLS guidance cho
Supabase. [<u>Nguồn chính
thức</u>](https://supabase.com/docs/guides/database/postgres/row-level-security)

**R13. FSRS.** Open Spaced Repetition. Spaced repetition scheduler.
[<u>Nguồn chính
thức</u>](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)

**R14. SLSA.** OpenSSF. Software supply-chain security framework.
[<u>Nguồn chính thức</u>](https://slsa.dev/spec/v1.2/)

**R15. Semantic Versioning 2.0.0.** SemVer. Public API versioning.
[<u>Nguồn chính thức</u>](https://semver.org/)

**R16. Conventional Commits 1.0.0.** Conventional Commits.
Machine-readable commit convention. [<u>Nguồn chính
thức</u>](https://www.conventionalcommits.org/en/v1.0.0/)

**R17. Unicode CLDR.** Unicode Consortium. Locale data và
internationalization. [<u>Nguồn chính
thức</u>](https://cldr.unicode.org/)

**R18. BCP 47 / RFC 5646.** RFC Editor. Language identification tags.
[<u>Nguồn chính thức</u>](https://www.rfc-editor.org/info/rfc5646/)

Kết thúc tài liệu v2.0. Mọi thay đổi làm mở rộng MVP, tách scheduler,
thêm AI/speech provider hoặc thay đổi dữ liệu/licensing phải đi qua
spec + ADR + contract review.
