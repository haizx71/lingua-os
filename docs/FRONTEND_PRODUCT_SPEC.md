**TÀI LIỆU 2**

LINGUA OS • UI/UX & Frontend Specification

Design system, information architecture, màn hình, states,
accessibility, responsive và frontend handoff

**Đối tượng bàn giao: Frontend/Product UI Engineer / UI designer / frontend agent**

Source of Truth v2.0

| **Tên sản phẩm**    | LINGUA OS                                                                                                 |
|---------------------|-----------------------------------------------------------------------------------------------------------|
| **Phạm vi bản đầu** | English for Vietnamese, kiến trúc đa ngôn ngữ                                                             |
| **Ngày cập nhật**   | 19/08/2026                                                                                                |
| **Quy tắc**         | MVP navigation chỉ chứa core learning loop. Deferred AI/Speech không được xuất hiện như tính năng sẵn có. |

Revision v2.0: MVP UI tập trung vào Today, Reader, Review, Language
Brain và Progress. AI Tutor và Speak Lab được giữ như future
specification nhưng không nằm trong navigation/acceptance gate của v0.1.
Placement đổi thành Starting Level Estimate. Progress phải làm Language
Brain nhìn thấy được ngay trong tuần đầu.

# 0. Vai trò của Frontend/Product UI Engineer

Frontend/Product UI Engineer chịu trách nhiệm biến product contract thành trải nghiệm hoàn
chỉnh. Frontend/Product UI Engineer không được thay đổi business logic, tự tạo endpoint, đổi
tên field API hoặc âm thầm bỏ state mà backend đã định nghĩa. Khi
backend chưa sẵn sàng, dùng mock được sinh từ contract.

**Mục tiêu thiết kế:** Giao diện phải làm người học hiểu ngay: hôm nay
nên làm gì, vì sao app chọn bài này, mình tiến bộ ở đâu và bước tiếp
theo là gì.

| **MUST**            | **SHOULD**                                  | **MUST NOT**                                     |
|---------------------|---------------------------------------------|--------------------------------------------------|
| WCAG 2.2 AA cho web | Dùng accessible primitives và semantic HTML | Không dựa duy nhất vào màu để truyền trạng thái. |
| Responsive/adaptive | Tối ưu desktop và mobile riêng              | Không co desktop layout thành mobile.            |
| Design tokens       | Component-driven qua Storybook              | Không hardcode style rải rác.                    |
| API contract-first  | Mock all loading/error/empty states         | Không tạo fake business rule trong UI.           |

# 1. Design principles

| **Nguyên tắc**             | **Biểu hiện trong UI**                                                                                             |
|----------------------------|--------------------------------------------------------------------------------------------------------------------|
| Learning first             | Một màn hình một mục tiêu chính, giảm lựa chọn không cần thiết.                                                    |
| Explainable adaptation     | Hiển thị lý do ngắn: “Ôn vì sắp quên”, “Luyện nghe vì đang yếu”.                                                   |
| Progress without noise     | Ưu tiên năng lực, retention, known vocabulary hơn XP/gem.                                                          |
| Visible Language Brain     | Trong tuần đầu, người dùng thấy concept nào đang biết, đang học, yếu, memory health và evidence cơ bản.            |
| Calm momentum              | Không ép người dùng bằng cảnh báo hoặc gamification gây áp lực.                                                    |
| Context before translation | Ví dụ, audio, phrase và sentence trước khi đẩy nghĩa rời rạc.                                                      |
| Input to active recall     | Mỗi ngày ưu tiên đọc/nghe và active recall hoặc production evidence qua Review. Speaking/writing mở rộng post-MVP. |
| Multilingual native        | Typography, line breaking, language labels, scripts được thiết kế từ đầu.                                          |
| Accessible by default      | Keyboard, focus, screen reader, contrast, target size là base requirement.                                         |

# 2. Chuẩn UI/UX bắt buộc

| **Chuẩn / công cụ**        | **Áp dụng**                                                          |
|----------------------------|----------------------------------------------------------------------|
| WCAG 2.2 AA                | Conformance target cho web.                                          |
| WAI-ARIA APG               | Keyboard/focus/roles cho dialog, tabs, menu, combobox, tooltip.      |
| Material Design 3          | Tham chiếu adaptive layout, interaction states, component behavior.  |
| Apple HIG                  | Tham chiếu mobile ergonomics, typography, accessibility, navigation. |
| DTCG Design Tokens 2025.10 | Format token chia sẻ giữa design và code.                            |
| Unicode CLDR               | Locale-aware numbers, dates, labels, pluralization.                  |
| BCP 47                     | Language tags như vi, en-US, zh-Hans, ja.                            |
| Radix Primitives           | Accessible low-level React primitives khi dùng shadcn/ui.            |
| Storybook                  | Component catalog, states, interaction và a11y QA.                   |
| Playwright + axe           | E2E, visual regression và automated a11y checks.                     |
| Core Web Vitals            | LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 ở p75 mục tiêu.                   |

# 3. Định vị thị giác

Phong cách: premium learning SaaS, hiện đại, tập trung, không trẻ con
hóa. Sản phẩm cần đủ ấm để học mỗi ngày nhưng đủ nghiêm túc để người
dùng coi progress là dữ liệu thật.

| **Thuộc tính** | **Hướng thiết kế**                                                |
|----------------|-------------------------------------------------------------------|
| Density        | Trung bình. Dashboard đủ dữ liệu nhưng không thành bảng quản trị. |
| Shape          | Bo góc vừa phải, ưu tiên hierarchy hơn decoration.                |
| Color          | Neutral foundation + một accent chính + semantic status.          |
| Illustration   | Dùng tiết chế ở onboarding, empty state, milestone.               |
| Motion         | Nhanh, có mục đích, hỗ trợ chuyển state.                          |
| Data viz       | Đơn giản, giải thích được, không dùng chart trang trí.            |
| Gamification   | Milestone và progress, tránh casino-like reward loop.             |
| Tone           | Ngắn, hỗ trợ hành động, không giảng đạo.                          |

# 4. Information Architecture

MVP primary navigation  
Today  
Read  
Review  
Brain  
Progress  
  
MVP secondary  
Dictionary / Search  
Library  
Settings  
Profile  
  
Post-MVP, feature-gated  
AI Tutor  
Speak Lab  
Pronunciation  
Chinese/Japanese language modes

| **Khu vực**         | **Mục tiêu**                                                                                   |
|---------------------|------------------------------------------------------------------------------------------------|
| Today               | Kế hoạch học tiếp theo trong time budget, có lý do chọn.                                       |
| Read                | Comprehensible input, word/sentence interaction, exposure và sentence mining.                  |
| Review              | Smart Review dùng một memory queue, nhiều exercise mode.                                       |
| Brain               | Trạng thái concept: known/learning/weak, recognition/listening/production, memory và evidence. |
| Progress            | Xu hướng học, memory health, retained concepts, weekly successful learning days.               |
| Dictionary / Search | Tra concept, ví dụ, pronunciation/audio, trạng thái học.                                       |
| Library             | Saved content, sentences, concepts, history.                                                   |
| Settings            | Goal, daily time, language, accessibility, privacy.                                            |
| AI Tutor / Speak    | Post-MVP. Không hiện trong nav nếu feature flag chưa bật.                                      |

# 5. Navigation model

| **Viewport**        | **Navigation**                                                                |
|---------------------|-------------------------------------------------------------------------------|
| Desktop ≥ 1200      | Left sidebar cố định, content max-width, optional right context rail.         |
| Tablet 768–1199     | Collapsible rail hoặc compact sidebar.                                        |
| Mobile \< 768       | Bottom navigation tối đa 5 mục chính, phần khác vào More/Profile.             |
| Learning focus mode | Ẩn navigation phụ, chỉ giữ back/close, progress và exit confirmation khi cần. |

- Today luôn là landing mặc định sau onboarding.

- Review phải truy cập được trong một tap từ Today và primary
  navigation; không chôn due queue dưới nhiều lớp.

- Back phải quay lại đúng context, không reset learning session.

- Deep link tới content/concept/session phải mở được khi đã auth.

MVP navigation invariant: Mobile primary nav tối đa 5 mục Today, Read,
Review, Brain, Progress. Không đặt placeholder/dead route cho AI Tutor
hoặc Speak Lab khi backend chưa bật feature.

# 6. Design tokens

Token source dùng DTCG format. Component chỉ tiêu thụ semantic token,
không dùng raw palette trực tiếp trừ primitive token layer.

token layers  
primitive.color.\*  
primitive.space.\*  
primitive.radius.\*  
primitive.type.\*  
  
semantic.bg.canvas  
semantic.bg.surface  
semantic.text.primary  
semantic.text.secondary  
semantic.border.default  
semantic.action.primary  
semantic.status.success  
semantic.status.warning  
semantic.status.danger  
semantic.focus.ring  
  
component.button.primary.\*  
component.card.learning.\*  
component.progress.\*

| **Token family** | **Quy tắc**                                                                |
|------------------|----------------------------------------------------------------------------|
| Color            | Light/dark semantic tokens. Không đặt tên theo màu nếu token mang ý nghĩa. |
| Spacing          | Base 4px hoặc scale tương đương. Không sinh spacing tùy ý.                 |
| Radius           | Ít cấp, thống nhất theo component role.                                    |
| Elevation        | Giảm shadow, dùng border/surface hierarchy trước.                          |
| Typography       | Semantic styles: display, title, body, label, mono/data.                   |
| Motion           | duration + easing tokens.                                                  |
| Focus            | Focus ring là semantic token bắt buộc.                                     |
| Chart            | Data series tokens có contrast và non-color differentiation.               |

# 7. Typography đa ngôn ngữ

- Font stack phải render tốt Vietnamese diacritics, Latin, Chinese và
  Japanese. Không ép một font Latin cho toàn bộ scripts.

- Line height tăng đủ cho dấu tiếng Việt và glyph CJK.

- Không dùng uppercase cho toàn bộ label trong CJK.

- Language sample giữ nguyên script gốc. Translation là lớp phụ.

- IPA dùng font/fallback có glyph đầy đủ.

- Số, thời gian, ngày và plural format qua Intl/CLDR.

| **Style**         | **Desktop** | **Mobile** | **Usage**                   |
|-------------------|-------------|------------|-----------------------------|
| Display           | 32–40       | 28–34      | Milestone, onboarding       |
| H1                | 26–30       | 24–28      | Page title                  |
| H2                | 20–24       | 19–22      | Section                     |
| Body              | 15–17       | 15–17      | Content                     |
| Learning sentence | 18–22       | 18–21      | Reader, listening, speaking |
| Label             | 12–14       | 12–14      | Controls, metadata          |
| Data              | 13–15       | 13–15      | Scores, metrics             |

# 8. Color, contrast và semantic state

| **State**      | **Visual**                     | **Không được làm**                           |
|----------------|--------------------------------|----------------------------------------------|
| Known/Mastered | Accent positive + icon/label   | Chỉ tô xanh mà không có text/icon.           |
| Learning       | Neutral/accent secondary       | Màu quá giống warning.                       |
| Weak           | Warning semantic               | Biến thành “failure” gây tiêu cực.           |
| Due            | Priority indicator             | Dùng red panic style cho review bình thường. |
| Correct        | Success + concise feedback     | Flash toàn màn hình gây gián đoạn.           |
| Incorrect      | Correction state + answer path | Punitive animation/sound.                    |
| Focus          | Visible focus ring             | Ẩn outline.                                  |
| Disabled       | Reduced emphasis               | Contrast thấp đến mức không đọc được label.  |

# 9. Layout và adaptive rules

| **Rule**       | **Specification**                                                                      |
|----------------|----------------------------------------------------------------------------------------|
| Content width  | Reading content 680–760px. Dashboard có thể rộng hơn.                                  |
| Grid           | Desktop 12-column hoặc CSS grid tương đương. Mobile single-column.                     |
| Touch target   | Tối thiểu theo WCAG target-size intent. Primary touch controls ưu tiên khoảng 44–48px. |
| Safe area      | Mobile tôn trọng safe-area insets.                                                     |
| Sticky         | Chỉ dùng cho action quan trọng, không che focus/content.                               |
| Split view     | Reader desktop: text + context panel. Mobile: bottom sheet/detail route.               |
| Learning focus | Giảm chrome trong quiz/speaking/assessment.                                            |
| Landscape      | Không giả định portrait duy nhất trên tablet/mobile.                                   |

# 10. Component system

| Nhóm                | Components                                                                                                         |
|---------------------|--------------------------------------------------------------------------------------------------------------------|
| Navigation          | AppShell, Sidebar, BottomNav, Breadcrumb, Tabs                                                                     |
| Actions             | Button, IconButton, SplitButton, OverflowMenu                                                                      |
| Input               | TextField, SearchField, Select, Checkbox, Radio, Slider, SegmentedControl                                          |
| Feedback            | Toast, InlineAlert, Progress, Skeleton, EmptyState, ErrorState                                                     |
| Learning \[MVP\]    | ConceptChip, WordCard, ReviewCard, AnswerOption, AudioPlayer, ReaderSentence, TranslationReveal, VocabularyPopover |
| Content \[MVP\]     | ContentCard, DifficultyBadge, KnownRatio, SourceMeta                                                               |
| Progress \[MVP\]    | SkillMeter, BrainSummary, MasteryBadge, TrendCard, MemoryHealth                                                    |
| Speech \[post-MVP\] | RecordButton, PronunciationToken, Waveform, SpeechFeedback                                                         |
| AI \[post-MVP\]     | TutorBubble, CorrectionCard, TargetUsageChip, ConversationSummary                                                  |
| System              | Modal, Drawer, Sheet, Tooltip, Popover, Dialog, CommandMenu                                                        |

**Component rule:** Mọi component interactive phải có default, hover,
focus, active, disabled, loading, error khi phù hợp. Storybook phải chứa
state matrix, không chỉ ảnh “happy path”.

# 11. Accessibility interaction rules

- Dùng native semantic HTML trước ARIA.

- Dialog trap focus đúng, Esc đóng khi phù hợp, trả focus về trigger.

- Tabs, menu, combobox và disclosure theo keyboard pattern của WAI-ARIA
  APG.

- Audio player có control keyboard và accessible names.

- Nếu Speak feature được bật, recording state không được truyền đạt chỉ
  bằng màu. Luôn có text, icon và trạng thái focus rõ ràng.

- Correction highlight có text description cho screen reader.

- Timer trong assessment không gây mất dữ liệu khi hết thời gian và phải
  được thông báo hợp lý.

- Motion tôn trọng prefers-reduced-motion.

- Contrast và focus visible đạt WCAG 2.2 AA.

# 12. Global UI states

| **State**         | **Behavior bắt buộc**                                         |
|-------------------|---------------------------------------------------------------|
| Loading           | Skeleton theo final layout, tránh layout shift.               |
| Empty             | Giải thích vì sao trống + next action.                        |
| Error recoverable | Message cụ thể + retry giữ context.                           |
| Error terminal    | Support path hoặc back to safe screen.                        |
| Offline           | Cho xem cache, queue action nếu safe, chỉ rõ sync pending.    |
| Unauthorized      | Route về auth, preserve intended destination.                 |
| Rate limited      | Countdown/retry guidance nếu API cung cấp.                    |
| Stale data        | Hiển thị last updated khi có ý nghĩa.                         |
| Partial success   | Không rollback UI thành failure toàn bộ nếu một phần đã lưu.  |
| Long processing   | Progress/status polling hoặc streaming, không spinner vô hạn. |

# 13. Onboarding flow

Welcome → Native language → Target language → Goal → Daily time → Self
estimate → Starting Level Estimate invitation → Result/confidence →
First Today Plan

| **Screen**        | **Primary action**                      | **Data**                                            |
|-------------------|-----------------------------------------|-----------------------------------------------------|
| Welcome           | Bắt đầu                                 | locale                                              |
| Language setup    | Chọn English                            | nativeLanguage, targetLanguage                      |
| Goal              | Chọn giao tiếp/công việc/du lịch/cơ bản | goal                                                |
| Time              | 10/20/30/45 min                         | dailyMinutes                                        |
| Self estimate     | Mất gốc → advanced                      | selfEstimate                                        |
| Starting estimate | Bắt đầu hoặc bỏ qua                     | assessment choice                                   |
| Result            | Xem ước lượng khởi điểm + confidence    | estimate, assessedSkills, confidence, methodVersion |
| First plan        | Start Today                             | generated plan                                      |

- Không yêu cầu microphone trong MVP onboarding. Notification vẫn
  optional và chỉ xin sau khi người dùng hiểu lợi ích.

- Starting estimate result giải thích confidence, những kỹ năng đã được
  đo và nhấn mạnh đây là điểm khởi đầu để hệ thống tiếp tục tự hiệu
  chỉnh.

- Cho chỉnh goal/time sau onboarding.

# 14. Starting Level Estimate UX

- Focus mode. Không sidebar đầy đủ.

- Progress dùng range hoặc section progress nếu adaptive test không biết
  tổng số câu chính xác.

- Audio question có replay limit nếu assessment policy yêu cầu, UI phải
  phản ánh rõ.

- Skip/Not sure là answer state có chủ đích nếu backend hỗ trợ.

- Result: estimated starting level/range + assessed skill evidence +
  confidence + recommended next step. Không hiển thị như chứng chỉ CEFR.

- Không biến placement thành bài thi căng thẳng bằng countdown nếu không
  cần.

Wording rule: dùng “Ước lượng khởi điểm”, “Độ tin cậy: thấp/vừa/cao”,
“Sẽ chính xác hơn khi bạn học”. Tránh “Trình độ chính thức của bạn là
B1” khi chưa có assessment chuẩn hóa.

# 15. TODAY, màn hình lõi

Today phải trả lời bốn câu trong 5 giây: Hôm nay học bao lâu? Có bao
nhiêu việc? Vì sao các việc này được chọn? Bắt đầu ở đâu?

Desktop  
\[Greeting + Today goal\] \[Memory health\]  
\[25 min • 4 activities\] \[Focus today\]  
  
\[Continue / Start primary card\]  
  
Activity timeline  
1 Review 8 min 23 due reason: sắp quên  
2 Learn 4 min 4 concepts reason: vừa gặp trong bài đọc  
3 Read 10 min story reason: 95% concepts quen  
4 Listen 3 min sentence reason: đọc biết nhưng nghe yếu  
  
\[Session summary → Brain updated\]

| **Element**   | **Rule**                                                                  |
|---------------|---------------------------------------------------------------------------|
| Primary CTA   | Một nút Start/Continue rõ nhất.                                           |
| Activity card | Icon, title, duration, reason, progress, status.                          |
| Reason        | Ngắn, human-readable, không lộ công thức score.                           |
| Reorder       | MVP không cho reorder nếu phá adaptive logic, trừ khi product quyết định. |
| Completion    | Nhẹ nhàng, hiển thị năng lực tăng hoặc session summary.                   |
| Streak        | Secondary, không chiếm hierarchy lớn.                                     |

# 16. Review UX

| **Phase** | **UI**                                                  |
|-----------|---------------------------------------------------------|
| Prompt    | Word/audio/cloze/sentence prompt. Không lộ answer.      |
| Think     | Cho user chủ động reveal hoặc submit.                   |
| Answer    | Hiện answer + context + audio.                          |
| Rating    | Again / Hard / Good / Easy, giải thích ngắn khi cần.    |
| Feedback  | Correctness và memory rating là hai tín hiệu khác nhau. |
| Next      | Immediate transition, keyboard shortcuts trên desktop.  |

- Hiển thị queue progress nhưng tránh tạo áp lực nếu còn nhiều due
  items.

- Audio review phải có visual play state và replay control.

- Support typing, multiple choice, self-recall, cloze và listening tùy
  exerciseMode. Các mode là presentation/evidence khác nhau, không được
  hiển thị như nhiều lịch ôn độc lập cho cùng concept trong MVP.

- Không dùng swipe-only interaction cho action quan trọng.

Memory UX invariant: Again/Hard/Good/Easy cập nhật một review lineage
chính. UI không hiển thị ba due date riêng cho
recognition/listening/production ở v0.1.

# 17. Reader / Immersion UX

Desktop split view  
Left: reading text  
Right: selected concept / sentence details  
  
Sentence interaction  
Tap/Click word → concept popover  
Tap sentence → translation / audio / save  
  
Mobile  
Text full width  
Concept details → bottom sheet or dedicated detail screen

| **Feature**            | **Behavior**                                                                                        |
|------------------------|-----------------------------------------------------------------------------------------------------|
| Knownness highlighting | Off by default hoặc subtle. User toggle.                                                            |
| Word tap               | Meaning, pronunciation, level, status, quick save.                                                  |
| Sentence save          | Một tap, feedback nhỏ, không mở modal nặng.                                                         |
| Translation            | Reveal theo sentence, không luôn hiện full translation.                                             |
| Audio                  | Sentence-level play và content-level playback.                                                      |
| Difficulty             | Hiển thị fit: “96% từ quen thuộc”, không chỉ A2/B1.                                                 |
| Reading progress       | Persist vị trí.                                                                                     |
| Brain update           | Sau reading/session, cho biết nhẹ nhàng số concepts exposed/strengthened; không pop-up sau từng từ. |
| Unknown word overload  | Nếu quá khó, đề xuất content phù hợp hơn.                                                           |

# 18. Dictionary và Concept Detail

| **Section**              | **Content**                                                                                |
|--------------------------|--------------------------------------------------------------------------------------------|
| Header                   | canonical form, pronunciation/audio, POS, status, add/remove learning.                     |
| Meanings                 | sense-based definitions/translations.                                                      |
| Examples                 | Difficulty-aware sentences.                                                                |
| Usage                    | phrases/collocations/word family khi có dữ liệu.                                           |
| Brain state              | recognition, listening, production, memory state, confidence, exposure count, last seen.   |
| Review                   | next due / quick review action khi concept active; không tạo modality due dates.           |
| Language-specific future | Chinese tones/radicals; Japanese readings/furigana chỉ khi mode tương ứng được triển khai. |
| Source                   | Attribution/provenance khi license/source yêu cầu.                                         |

# 19. AI Tutor UX, post-MVP

AI Tutor là future specification. Frontend/Product UI Engineer không implement route,
navigation item hoặc giả API trong v0.1. Khi feature flag được bật,
Tutor phải là activity có mục tiêu học rõ, không phải chat app chung
chung.

Header  
Scenario: Reschedule an appointment  
Targets: appointment • available • would like  
Level: A2  
  
Conversation  
AI prompt  
User text/voice  
Inline correction only when useful  
  
Session end  
Targets used 3/3  
Grammar observations  
Pronunciation observations  
2 items added to review

- Correction card tách “Bạn nói”, “Cách tự nhiên hơn”, “Vì sao”.

- Không sửa lỗi nhỏ liên tục làm đứt hội thoại.

- Voice và text modes giữ cùng session context.

- Model error phải có Retry turn, không mất user message.

- Hiển thị AI nature rõ, không giả người thật.

Feature gate: Nếu /features.aiTutor = false hoặc contract chưa tồn tại,
UI không render CTA/route “coming soon” trong core navigation. Không để
người dùng tưởng đây là tính năng đã sẵn sàng.

# 20. Speak Lab và Pronunciation, post-MVP

| **View**        | **UI behavior**                                             |
|-----------------|-------------------------------------------------------------|
| Listen & repeat | Native audio, playback speed, transcript toggle.            |
| Record          | Large accessible record control, timer, waveform secondary. |
| Analyze         | Processing state có text.                                   |
| Feedback        | Word-level highlight + low-confidence distinction.          |
| Phoneme         | Chỉ hiển thị khi evidence đủ tin cậy.                       |
| Compare         | Native / Mine playback.                                     |
| Retry           | Giữ history attempts trong session.                         |
| Shadowing       | Line-by-line và continuous modes.                           |

Future feedback tone: Không dùng “phát âm sai” khi model confidence
thấp. UI chỉ hiển thị phoneme/word-level judgment khi backend cung cấp
evidence + confidence đủ rõ. Không giả định Montreal Forced Aligner chạy
realtime.

# 21. Language Brain và Progress

English  
Starting estimate: A2 • confidence: medium  
  
Your Language Brain  
Known / stable 483  
Learning 71  
Weak 28  
Memory health 87%  
  
Signals  
Recognition 72%  
Listening 54%  
Production 38%  
  
This week  
+43 concepts exposed  
+18 concepts strengthened  
5 successful learning days  
  
Recent concept  
appointment  
Seen 8 times • recognition strong • listening developing • production
low  
Next review: tomorrow

- Không gộp mọi thứ thành XP hoặc một mastery score duy nhất. Starting
  level estimate là secondary context; Language Brain evidence mới là
  phần tiến bộ người dùng nhìn thấy thường xuyên.

- Mọi số liệu có tooltip/description đủ hiểu.

- Confidence thấp được biểu thị nếu estimate còn ít evidence.

- Trend chart có alternative text/summary.

Brain screen phải tạo “aha moment” trong 3–7 ngày đầu: người dùng thấy
app nhớ mình đã gặp từ nào, kỹ năng nào yếu hơn và vì sao Today chọn bài
tiếp theo.

# 22. Knowledge Map, post-MVP

Knowledge Map dạng hierarchy/graph đầy đủ là post-MVP. v0.1 chỉ cần
Brain list + filters + concept detail. Không dành thời gian cho graph 3D
hoặc visualization phức tạp trước khi core loop được kiểm chứng.

| **Level**          | **Ví dụ**                                              |
|--------------------|--------------------------------------------------------|
| L1 Skill           | Vocabulary, Listening, Speaking, Grammar.              |
| L2 Subskill        | Listening → word recognition, connected speech, speed. |
| L3 Concept cluster | Present perfect, travel phrases, /θ/.                  |
| L4 Concept detail  | Evidence, last seen, memory, example, review action.   |

# 23. Library

| **Tab**       | **Nội dung**                |
|---------------|-----------------------------|
| Saved content | Stories/articles/dialogues. |
| Sentences     | Sentence mining collection. |
| Concepts      | Saved/learning concepts.    |
| Downloads     | Offline assets nếu có.      |
| History       | Recently studied content.   |

- Search + filter theo language, level, status, topic.

- Không làm Library thành file manager kỹ thuật.

- Card phải cho biết progress/resume point.

# 24. Settings, privacy và accessibility

| **Group**       | **Settings**                                                                               |
|-----------------|--------------------------------------------------------------------------------------------|
| Learning        | Goal, daily minutes, target level, new concept budget.                                     |
| Language        | UI locale, learning language, translation language.                                        |
| Audio           | Autoplay, playback speed defaults. Microphone chỉ xuất hiện khi Speak feature được bật.    |
| Accessibility   | Reduced motion, larger text compatibility, captions/transcript preferences.                |
| Notifications   | Review reminder, daily plan reminder.                                                      |
| Privacy         | Data export, delete account. Audio retention chỉ xuất hiện khi recording feature được bật. |
| AI \[post-MVP\] | Personalization và context controls chỉ xuất hiện khi AI Tutor feature được bật.           |

# 25. UX writing rules

| **Tình huống**          | **Viết như này**                              | **Tránh**                               |
|-------------------------|-----------------------------------------------|-----------------------------------------|
| Success                 | “Đã thêm vào ôn tập”                          | “Awesome! You are amazing!!!”           |
| Error                   | “Không lưu được. Thử lại.”                    | “Something went wrong.”                 |
| Adaptive reason         | “Luyện nghe vì phần này đang yếu”             | “AI optimized algorithm selected this.” |
| Review due              | “23 mục đến hạn”                              | “Bạn đang tụt streak!”                  |
| Correction              | “Tự nhiên hơn: …”                             | “Sai!”                                  |
| Permission \[post-MVP\] | Cho phép mic khi bạn bật tính năng luyện nói. | Microphone access required.             |

# 26. Motion và sound

- Motion dùng để biểu thị state change, hierarchy, completion và spatial
  relationship.

- Default transition nhanh. Không animation dài giữa từng flashcard.

- prefers-reduced-motion giảm hoặc bỏ movement không cần thiết.

- Sound feedback mặc định nhẹ hoặc tắt được. Không phụ thuộc sound để
  truyền correct/error.

- Audio playback có visual + text cues. Recording chỉ áp dụng khi Speak
  feature được bật và phải có trạng thái text rõ ràng.

# 27. Responsive screen matrix

| **Screen**            | **Desktop**                       | **Mobile**                         |
|-----------------------|-----------------------------------|------------------------------------|
| Today                 | 2-column optional context rail    | Single column, bottom nav          |
| Review                | Centered focus card               | Full-height focus card             |
| Reader                | Split text/detail                 | Text + bottom sheet/detail route   |
| Brain                 | Concept list + state/detail panel | List/filter → concept detail route |
| Progress              | Metrics + trend cards             | Stacked cards, drill-down          |
| Dictionary            | Search + detail pane              | Search route → detail route        |
| AI Tutor \[post-MVP\] | Conversation + targets            | Feature-gated route                |
| Speak \[post-MVP\]    | Record/feedback                   | Feature-gated route                |

# 28. Frontend architecture boundary

Frontend/Product UI Engineer được triển khai frontend nhưng không sở hữu domain contract.

/apps/web  
/app  
/components  
/ui \# primitives  
/learning \# domain presentation components  
/features  
/today  
/review  
/reader  
/brain  
/progress  
/library  
/assessment  
\# Do not create /tutor or /speak in MVP unless approved feature
contracts exist.  
/lib  
/api \# generated SDK wrapper only  
/i18n  
/analytics  
/feature-flags  
/stores \# UI/client state only  
/stories  
/tests  
  
Do not duplicate server domain rules in client stores.

| **State type**     | **Owner**                                                    |
|--------------------|--------------------------------------------------------------|
| Server data        | Query/cache layer + generated SDK.                           |
| Form state         | Local/form library.                                          |
| Ephemeral UI state | Component/store.                                             |
| Auth session       | Approved auth integration.                                   |
| Business decision  | Backend response.                                            |
| Feature flag       | Central flag service/config, not hardcoded component branch. |
| Design token       | /design/tokens source.                                       |

## 28.1 Feature-gate contract

Frontend chỉ render feature khi contract + central feature flag xác nhận
available. Không suy ra “có route” từ mock hoặc design. Deferred feature
phải tree-shake/lazy-load được và không làm tăng bundle/runtime
dependency của MVP.

# 29. API integration rules

- Import types/client từ generated SDK.

- Không fetch trực tiếp URL string rải rác trong component.

- Map API errors theo error.code, không parse message text.

- Support request cancellation khi route đổi.

- Optimistic UI chỉ cho action có rollback/idempotency rõ.

- Không fake completion nếu server chưa xác nhận critical learning
  event.

- Mock data được generate hoặc validate bằng JSON Schema/OpenAPI.

# 30. Storybook và component QA

| **Story requirement** | **Ví dụ**                                                                                         |
|-----------------------|---------------------------------------------------------------------------------------------------|
| Default               | ReviewCard default                                                                                |
| Long text             | German/English long phrase, Vietnamese translation                                                |
| CJK                   | Chinese/Japanese glyph rendering                                                                  |
| Loading               | Skeleton                                                                                          |
| Empty                 | No reviews due                                                                                    |
| Error                 | Network fail                                                                                      |
| Keyboard              | Dialog/menu/tabs behavior                                                                         |
| Dark mode             | All core components                                                                               |
| Reduced motion        | Animation disabled/reduced                                                                        |
| High zoom             | 200% browser zoom sanity                                                                          |
| Feature-gated         | AI Tutor/Speak unavailable state không xuất hiện như dead navigation; test central flag behavior. |

- A11y addon chạy trong CI cho core components.

- Visual regression cho primitives và key learning screens.

- Playwright chạy Chromium, Firefox, WebKit trên critical journeys khi
  khả thi.

- Automated a11y không thay manual keyboard/screen-reader review.

# 31. Performance budgets

| **Metric** | **Target**                                          |
|------------|-----------------------------------------------------|
| LCP        | ≤ 2.5s p75                                          |
| INP        | ≤ 200ms p75                                         |
| CLS        | ≤ 0.1 p75                                           |
| Route JS   | Giữ nhỏ, lazy load AI/speech/visualization feature. |
| Images     | Responsive formats, explicit dimensions.            |
| Audio      | Do not preload large audio indiscriminately.        |
| Fonts      | Minimize families/weights, script-aware fallback.   |
| Skeleton   | Match final dimensions to avoid shift.              |

# 32. Acceptance criteria cho từng màn hình

| **Màn hình**             | **Pass khi**                                                                                              |
|--------------------------|-----------------------------------------------------------------------------------------------------------|
| Today                    | Start action rõ, plan reasons hiển thị, time budget đúng, loading/error/empty/completed đủ.               |
| Review                   | Keyboard/touch usable, answer vs rating tách rõ, một memory queue persist và retry-safe.                  |
| Reader                   | Word/sentence interaction không phá reading flow, exposure/save cập nhật server, mobile detail usable.    |
| Brain                    | Known/learning/weak + recognition/listening/production/memory/confidence đọc được; concept drill-down rõ. |
| Progress                 | Trend/weekly learning days/memory health có định nghĩa, không overclaim CEFR, mobile readable.            |
| Starting Estimate        | Result có confidence, assessed skills và wording “ước lượng khởi điểm”.                                   |
| Library/Settings         | Resume/filter/save rõ; privacy/accessibility changes confirm/save đúng contract.                          |
| Tutor/Speak \[post-MVP\] | Không thuộc MVP release gate. Chỉ kiểm thử khi feature flag và backend contract được bật.                 |

# 33. Definition of Done cho frontend feature

- Matches approved information architecture và contract.

- Responsive ở mobile, tablet, desktop.

- Keyboard usable và focus order hợp lý.

- WCAG 2.2 AA automated checks không có blocker đã biết.

- Loading, empty, error, offline/stale state khi relevant.

- Dark/light themes nếu project bật cả hai.

- Long text, Vietnamese diacritics và CJK smoke test.

- Storybook stories cho component mới.

- Visual regression update được review, không blindly accept.

- No hardcoded API endpoint, business rule, magic color/spacing.

# 34. Implementation roadmap cho Frontend/Product UI Engineer

| **Phase** | **Deliverable**                                                    |
|-----------|--------------------------------------------------------------------|
| U0        | Design tokens, typography, color, layout primitives, Storybook.    |
| U1        | App shell + MVP navigation: Today, Read, Review, Brain, Progress.  |
| U2        | Onboarding + Starting Level Estimate + confidence/result states.   |
| U3        | Today + activity cards + reason codes + completed summary.         |
| U4        | Smart Review + one-queue UX + exercise mode states.                |
| U5        | Reader + Dictionary/Concept Detail + save/exposure feedback.       |
| U6        | Language Brain list/detail, filters, known/learning/weak states.   |
| U7        | Progress trends + weekly successful learning days + memory health. |
| U8        | Library + Settings + privacy/accessibility.                        |
| U9        | A11y, responsive, visual regression, performance and MVP polish.   |
| POST-U10  | AI Tutor UI after approved backend contract/feature flag.          |
| POST-U11  | Speak/Pronunciation UI after approved speech provider contract.    |
| POST-U12  | Chinese/Japanese language-specific UI system.                      |

# 35. Prompt bàn giao baseline cho Frontend/Product UI Engineer

You are the UI/UX and frontend owner for LINGUA OS.  
Treat this specification, /packages/contracts, /design/tokens and
/docs/product as source of truth.  
The v0.1 MVP boundary is hard: Today, Read, Review, Brain, Progress,
onboarding/Starting Level Estimate, Dictionary/Library/Settings.  
Do not implement or surface AI Tutor, Speak/Pronunciation or
Chinese/Japanese modes unless an approved contract and central feature
flag exist.  
Do not invent backend behavior, API fields, endpoints, learner scores or
learning rules.  
Build from design tokens and reusable accessible components.  
Target WCAG 2.2 AA. Use semantic HTML and WAI-ARIA APG patterns.  
Make Language Brain visible: show evidence/confidence/status without
turning progress into XP or a single magic score.  
Use generated API SDK and validated mocks only.  
For every MVP feature, implement loading, empty, error, stale/offline
and success states when relevant.  
Add Storybook stories and interaction/a11y tests for new components.  
Preserve multilingual typography and BCP 47/CLDR-aware formatting, while
English/Vietnamese are the only shipped learning/UI scope in v0.1.  
Before finishing a screen, verify keyboard navigation, focus, long text,
Vietnamese diacritics, 200% zoom and reduced motion.  
If requested UI conflicts with the contract or MVP boundary, report the
conflict instead of silently expanding scope.

# 36. Handoff checklist giữa Frontend/Product UI Engineer và Backend/System Engineer

| **Khi Frontend/Product UI Engineer cần**     | **Artifact từ Backend/System Engineer**                                                                                       |
|------------------------|-------------------------------------------------------------------------------------------------------------|
| Render Today           | GET /v1/today schema + reason codes + mock loading/empty/completed states.                                  |
| Submit Review          | Review request/response + exerciseMode + rating/error/idempotency behavior.                                 |
| Reader                 | Content/concept DTO + sentence concept offsets + save/exposure mutation contracts.                          |
| Brain                  | Concept state DTO: status, recognition, listening, production, memory, confidence, exposureCount, lastSeen. |
| Progress               | Metric definitions, trend windows, confidence and Starting Estimate wording fields.                         |
| Assessment             | Estimate/result DTO + assessed skills + confidence + methodVersion.                                         |
| Tutor/Speak \[future\] | Chỉ khi feature approved: provider/status contracts + feature flag.                                         |
| Settings               | Editable profile fields + validation/privacy rules.                                                         |

| **Khi Backend/System Engineer cần**          | **Artifact từ Frontend/Product UI Engineer**          |
|----------------------------|---------------------------------|
| Know required state        | ui-state-matrix.md              |
| Know payload fields needed | Screen data requirements        |
| Know realtime expectation  | Loading/streaming behavior spec |
| Know pagination/filter UX  | Query contract requirements     |
| Know accessibility labels  | Component semantics             |
| Know error behavior        | Error code to UI mapping        |

# Nguồn chuẩn và tài liệu tham chiếu

**R1. WCAG 2.2.** W3C WAI. Accessibility conformance baseline. [<u>Nguồn
chính thức</u>](https://www.w3.org/TR/WCAG22/)

**R2. ARIA Authoring Practices Guide.** W3C WAI. Accessible widget
patterns, semantics và keyboard. [<u>Nguồn chính
thức</u>](https://www.w3.org/WAI/ARIA/apg/)

**R3. Material Design 3.** Google. Adaptive layout, states và component
guidance. [<u>Nguồn chính thức</u>](https://m3.material.io/)

**R4. Apple Human Interface Guidelines.** Apple. Mobile interaction,
layout, accessibility, typography. [<u>Nguồn chính
thức</u>](https://developer.apple.com/design/human-interface-guidelines)

**R5. Design Tokens Format Module 2025.10.** DTCG. Stable token exchange
format from DTCG. [<u>Nguồn chính
thức</u>](https://www.designtokens.org/TR/2025.10/format/)

**R6. Unicode CLDR.** Unicode Consortium. Locale data cho multilingual
UI. [<u>Nguồn chính thức</u>](https://cldr.unicode.org/)

**R7. BCP 47 / RFC 5646.** RFC Editor. Language tags. [<u>Nguồn chính
thức</u>](https://www.rfc-editor.org/info/rfc5646/)

**R8. Radix UI Accessibility.** Radix. Accessible React primitives.
[<u>Nguồn chính
thức</u>](https://www.radix-ui.com/primitives/docs/overview/accessibility)

**R9. Storybook Accessibility Testing.** Storybook. Component-level a11y
tests and CI. [<u>Nguồn chính
thức</u>](https://storybook.js.org/docs/writing-tests/accessibility-testing)

**R10. Playwright Accessibility Testing.** Microsoft Playwright.
Automated browser accessibility checks. [<u>Nguồn chính
thức</u>](https://playwright.dev/docs/accessibility-testing)

**R11. Playwright Visual Comparisons.** Microsoft Playwright. Visual
regression testing. [<u>Nguồn chính
thức</u>](https://playwright.dev/docs/test-snapshots)

**R12. Core Web Vitals.** web.dev. LCP, INP, CLS user experience
thresholds. [<u>Nguồn chính thức</u>](https://web.dev/articles/vitals)

**R13. W3C Mobile Accessibility Guidance.** W3C WAI. Applying WCAG 2.2
to mobile apps. [<u>Nguồn chính
thức</u>](https://www.w3.org/TR/wcag2mobile-22/)

**R14. OpenAPI Specification 3.2.** OpenAPI Initiative. Frontend API
contract source. [<u>Nguồn chính
thức</u>](https://spec.openapis.org/oas/v3.2.0.html)

**R15. GitHub Spec Kit.** GitHub. Spec-driven handoff between agents.
[<u>Nguồn chính thức</u>](https://github.github.com/spec-kit/)

Kết thúc tài liệu v2.0. UI không được mở rộng MVP bằng placeholder route
hoặc mock-only feature. Mọi field/state mới phải quay lại contract
review với Backend/System Engineer.
