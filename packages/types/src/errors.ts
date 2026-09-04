/** Safe frontend error normalization for the authoritative machine-readable error catalog. */
import errorRegistry from '../../../contracts/errors.json';
import type { ApiErrorCode, ApiErrorEnvelope, ApiSchema } from './api/dtos';
import { AuthTokenProviderError } from './auth';

export type { ApiErrorCode, ApiErrorEnvelope } from './api/dtos';
export type ApiErrorResponse = ApiErrorEnvelope;
export type ApiErrorDetail = ApiErrorEnvelope['error'];
export type ValidationIssue = ApiSchema<'ValidationIssue'>;
export type UiErrorCode = ApiErrorCode | 'NETWORK_ERROR';

export const API_ERROR_CODES = Object.freeze(
  errorRegistry.errors.map(({ code }) => code)
) as readonly ApiErrorCode[];

export const ERROR_HTTP_STATUS_MAP = Object.freeze(
  Object.fromEntries(errorRegistry.errors.map(({ code, http_status }) => [code, http_status]))
) as Readonly<Record<ApiErrorCode, number>>;

export const ERROR_MESSAGE_VI_MAP: Readonly<Record<UiErrorCode, string>> = Object.freeze({
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy nội dung được yêu cầu.',
  PRECONDITION_FAILED: 'Dữ liệu đã thay đổi ở nơi khác. Vui lòng tải lại trước khi lưu.',
  CONFLICT: 'Thao tác xung đột với trạng thái hiện tại.',
  INVALID_STATE_TRANSITION: 'Không thể thực hiện thao tác ở trạng thái hiện tại.',
  IDEMPOTENCY_KEY_REUSED: 'Yêu cầu này đã được dùng cho một thao tác khác. Vui lòng thử lại.',
  VALIDATION_ERROR: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.',
  RATE_LIMITED: 'Bạn đang thao tác quá nhanh. Vui lòng chờ một chút.',
  SERVICE_UNAVAILABLE: 'Dịch vụ đang tạm gián đoạn. Vui lòng thử lại sau.',
  INTERNAL_ERROR: 'Hệ thống gặp sự cố tạm thời. Vui lòng thử lại sau.',
  NETWORK_ERROR: 'Không thể kết nối. Vui lòng kiểm tra đường truyền.',
});

export interface UiErrorState {
  readonly code: UiErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && API_ERROR_CODES.includes(value as ApiErrorCode);
}

export class LinguaApiError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(params: {
    code: ApiErrorCode;
    httpStatus?: number;
    requestId?: string;
    retryAfterSeconds?: number;
  }) {
    super(ERROR_MESSAGE_VI_MAP[params.code]);
    this.name = 'LinguaApiError';
    this.code = params.code;
    this.httpStatus = params.httpStatus ?? ERROR_HTTP_STATUS_MAP[params.code];
    this.requestId = params.requestId;
    this.retryAfterSeconds = params.retryAfterSeconds;
    Object.setPrototypeOf(this, LinguaApiError.prototype);
  }
}

/** Transport failure before an HTTP response exists. */
export class LinguaNetworkError extends Error {
  readonly code = 'NETWORK_ERROR' as const;
  readonly retryable = true;

  constructor(options?: { cause?: unknown }) {
    super(ERROR_MESSAGE_VI_MAP.NETWORK_ERROR, options);
    this.name = 'LinguaNetworkError';
    Object.setPrototypeOf(this, LinguaNetworkError.prototype);
  }
}

export const ApiNetworkError = LinguaNetworkError;

/** In-flight request discarded because active actor/session changed before response arrived. */
export class LinguaActorAbortedError extends Error {
  readonly code = 'ABORTED' as const;
  readonly retryable = false;

  constructor(message = 'Response discarded: active actor changed during in-flight request.') {
    super(message);
    this.name = 'LinguaActorAbortedError';
    Object.setPrototypeOf(this, LinguaActorAbortedError.prototype);
  }
}

export function isLinguaActorAbortedError(error: unknown): error is LinguaActorAbortedError {
  return error instanceof LinguaActorAbortedError;
}

export function isLinguaApiError(error: unknown): error is LinguaApiError {
  return error instanceof LinguaApiError;
}

export function createApiError(code: ApiErrorCode): LinguaApiError {
  return new LinguaApiError({ code });
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const detail = (value as { error?: unknown }).error;
  return (
    typeof detail === 'object' &&
    detail !== null &&
    'code' in detail &&
    isApiErrorCode((detail as { code: unknown }).code)
  );
}

/** Maps machine codes to local copy and deliberately ignores untrusted server/database messages. */
export function mapApiErrorToUi(error: unknown): UiErrorState {
  if (error instanceof LinguaActorAbortedError || (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ABORTED')) {
    return { code: 'NETWORK_ERROR', message: 'Yêu cầu đã bị hủy do thay đổi tài khoản.', retryable: false };
  }
  if (error instanceof AuthTokenProviderError) {
    if (error.code === 'UNAUTHENTICATED') {
      return { code: 'UNAUTHENTICATED', message: ERROR_MESSAGE_VI_MAP.UNAUTHENTICATED, retryable: false };
    }
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGE_VI_MAP.NETWORK_ERROR, retryable: true };
  }
  const detail = isLinguaApiError(error)
    ? error
    : isErrorEnvelope(error)
      ? error.error
      : undefined;

  if (!detail) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGE_VI_MAP.NETWORK_ERROR, retryable: true };
  }

  const code = detail.code;
  return {
    code,
    message: ERROR_MESSAGE_VI_MAP[code],
    retryable: !['UNAUTHENTICATED', 'FORBIDDEN', 'VALIDATION_ERROR'].includes(code),
    requestId: 'requestId' in detail ? detail.requestId : undefined,
    retryAfterSeconds: 'retryAfterSeconds' in detail ? detail.retryAfterSeconds : undefined,
  };
}
