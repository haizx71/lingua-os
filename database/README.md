# LINGUA OS database

PostgreSQL is the sole MVP system of record. The canonical schema is the ordered, paired SQL
history in `migrations/`; `schema.sql` is intentionally only an entry-point note so the project
does not maintain two DDL sources.

## Platform baseline

Production targets Supabase PostgreSQL. Migrations therefore expect the platform-owned
`auth.users` table, `auth.uid()` function, and `authenticated`/`anon` roles. The integration-test
bootstrap creates only those compatibility objects in a disposable plain PostgreSQL container;
it is not a production auth implementation.

## Commands

Set `DATABASE_URL` to an administrative/server-side PostgreSQL connection, then run:

```powershell
pnpm db:migrate
pnpm db:rollback
```

The equivalent direct commands are:

```powershell
python database/migrate.py up
python database/migrate.py down --steps 1
```

`up` discovers paired `NNNN_name.up.sql` and `NNNN_name.down.sql` files, takes a PostgreSQL
advisory lock, validates the stored combined checksum, and applies pending versions in a
transaction. Re-running it with an unchanged history is a no-op.

## Testing

Database tests use `TEST_DATABASE_URL` when supplied. Otherwise they create and remove an exact,
disposable container from `postgres:17.11-alpine3.24`. The database must be isolated because the
migration test intentionally rolls v1 back and re-applies it.

```powershell
python -m pytest tests/backend/database
```

## Memory Engine migration

`0002_memory_engine_fsrs_v1` mở rộng schema v1 với metadata phiên bản FSRS, seed bộ tham số
`fsrs6-global-default-v1`, ràng buộc trạng thái memory và metadata idempotency của review event.

`0003_review_idempotency_result_v1` lưu private post-transition memory snapshot trên review event
mới để delayed idempotent replay trả đúng kết quả lịch sử. Hàng legacy được phép để snapshot null
và được Memory Engine tái dựng từ immutable event/parameter history; dữ liệu này không phải public
API DTO.

`0004_learner_evidence_competence_v1` thiết lập `competence-beta-v1`: bộ tham số bất biến,
projection head theo language profile, chính sách mastery có phiên bản cho skill, canonical
`learning_events` append-only và các positive/negative evidence mass trên `user_concept_states` và
`user_skill_states`. Mọi công thức/hằng số được resolve từ lineage; parameter set và các policy
skill có phiên bản đều bất biến. Migration giữ nguyên các scalar projection cũ nhưng để lineage
null, vì vậy chúng không được diễn giải thành bằng chứng. Down migration chủ động từ chối sau khi
đã có hoạt động competence để tránh rollback mất dữ liệu.

`0005_reader_content_service_v1` bổ sung curated Reader level/segment type, authority
`user_content_progress`, durable Reader mutation snapshots, exposure source-to-concept fan-out và
publication gate đầy đủ. Cấu trúc content đã publish là bất biến; runtime đọc fail-closed theo toàn
bộ provenance/license/QA dependencies. Down migration từ chối sau khi có Reader progress,
idempotency result hoặc canonical passive exposure để không làm mất hoạt động learner.

Seed acceptance riêng của TASK-008 nằm tại `seeds/task008_reader_mvp.sql`; seed này chỉ dùng dữ liệu
LINGUA-authored nhỏ, xác định và có negative fixtures cho unpublished/restricted content.

Seed là tối thiểu, xác định và được áp dụng cùng transaction của migration.

## Recovery rule

Các down migration chỉ dành cho database phát triển/test rỗng hoặc dùng một lần. Down migration
`0002` chủ động từ chối nếu đã có review event hoặc FSRS state; `0004` từ chối nếu đã có canonical
learning event, projection lineage/head hoặc Review competence result. Khi có dữ liệu ứng dụng, hãy
khôi phục từ backup đã xác minh hoặc phát hành forward migration sửa lỗi; không chạy destructive
down migration trên production.
