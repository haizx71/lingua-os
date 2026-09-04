# Memory Engine FSRS v1

## Trạng thái và phạm vi

TASK-006 triển khai Memory Engine phía backend cho một dòng ký ức chính trên mỗi
`learner × concept`. Phạm vi này chỉ gồm kích hoạt dòng ký ức, ghi nhận review, chuyển trạng thái
FSRS và truy vấn các mục đã đến hạn. Nó không gồm HTTP API, Today Engine, placement, competence
scoring, AI Tutor hoặc speech scoring.

## Thư viện và phiên bản

- Thư viện: [`fsrs` / py-fsrs](https://github.com/open-spaced-repetition/py-fsrs)
- Phiên bản thư viện khóa: `6.3.2`
- Phiên bản thuật toán lưu trong dữ liệu: `FSRS-6`
- Bộ tham số mặc định: `fsrs6-global-default-v1`
- Giấy phép upstream: MIT

Phiên bản `6.3.2` được chọn vì đây là bản phát hành duy trì hiện hành khi TASK-006 được thực hiện,
hỗ trợ Python 3.10+, cung cấp mô hình FSRS-6 và đã sửa giới hạn stability cho review `Hard` trong
cùng ngày. LINGUA OS gọi API công khai của thư viện; không chép lại phương trình FSRS.

## Bộ tham số mặc định

Migration `0002_memory_engine_fsrs_v1` seed một hàng bất biến với:

- weights:
  `0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
  0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658,
  0.1542`
- desired retention: `0.9`
- learning steps: `1m`, `10m`
- relearning steps: `10m`
- maximum interval: `36500` ngày
- fuzzing: tắt để các chuyển trạng thái có cùng input và thời điểm cho kết quả xác định

Mỗi `fsrs_state` và `review_event` tham chiếu bộ tham số đã sử dụng. Bộ tham số đã được tham chiếu
không được sửa. Việc tối ưu tham số theo cohort hoặc learner là ranh giới tương lai: tạo một phiên
bản mới thay vì sửa lịch sử; dòng ký ức hiện hữu tiếp tục dùng phiên bản đã gắn với nó.

## Mô hình dòng ký ức

`review_items` giữ ràng buộc duy nhất `(user_id, concept_id)`. Khi kích hoạt, hệ thống tạo đồng
thời đúng một `fsrs_state` ở trạng thái `new`, chưa có difficulty/stability/due date. Competence
signals nằm ở bảng riêng và không bị Memory Engine cập nhật.

Các rating được chấp nhận là `again`, `hard`, `good`, `easy`. Exercise mode hợp đồng được ánh xạ
sang evidence mode nội bộ như sau:

| Exercise mode | Evidence mode |
| --- | --- |
| `self_recall` | `production` |
| `multiple_choice` | `recognition` |
| `typing` | `production` |
| `cloze` | `cloze` |
| `listening` | `listening` |

## Giao dịch, idempotency và đồng thời

Một review chạy trong một transaction PostgreSQL:

1. Khóa `review_item` và `fsrs_state` bằng `SELECT ... FOR UPDATE` trong ownership boundary của
   actor đã xác thực.
2. Kiểm tra `idempotency_key` cùng fingerprint chuẩn hóa của request.
3. Dùng snapshot đã khóa và clock UTC được inject để gọi py-fsrs.
4. Ghi immutable `review_event`, cập nhật `fsrs_state` với version kế tiếp và chạm
   `review_item.updated_at`.
5. Commit tất cả hoặc rollback tất cả.

Replay cùng key và cùng fingerprint không tiến lịch lần hai. Từ TASK-006A, event mới lưu exact
private post-transition snapshot để retry A sau review B vẫn trả memory result của A. Event legacy
chưa có snapshot được tái dựng bằng immutable history và parameter version đã khóa. Dùng lại key
cho payload/lineage khác bị từ chối. Race cùng actor/key trên hai lineage được chuyển thành domain
`IdempotencyConflict`, không lộ `UniqueViolation`. Khóa hàng nối tiếp hóa các review đồng thời trên
cùng lineage; version check là lớp bảo vệ bổ sung chống lost update.

## Thời gian, due query và log

Tất cả thời điểm là `TIMESTAMPTZ` UTC và thuật toán nhận thời gian từ `Clock`, nên test không phụ
thuộc thời gian thực. Due query chỉ trả lineage active thuộc actor, có `due_at <= now`, sắp xếp
`due_at, review_item_id` và có giới hạn. Đây không phải logic xếp hạng của Today Engine.

Log là JSON có cấu trúc, dùng mã actor đã băm và metadata vận hành. Không ghi response text,
payload nhạy cảm hay thông báo lỗi cơ sở dữ liệu cho client.

## Review API adapter (TASK-006A)

`GET /v1/review/queue` dùng cursor keyset ký HMAC với fixed `asOf`, sắp xếp `due_at,
review_item_id`; không có offset hay Today ranking. `POST /v1/review/{reviewItemId}/answer` ánh xạ
Bearer actor, UUID idempotency key và request DTO vào `PostgresMemoryEngine`; route không tính FSRS.

Competence trong response chỉ đọc ba projection `user_skill_states` hiện có. Thiếu một chiều là lỗi
cấu hình an toàn, không điền số giả và không suy ra từ rating. `remainingDueCount` được đếm sau
transition, trong cùng transaction, cho language profile của review item tại `reviewed_at`. Với
replay, memory result giữ nguyên kết quả lịch sử; competence và remaining count là read projection
hiện tại tại thời điểm retry.
