import { NextResponse } from 'next/server';
import { createK2VercelOperationalAttestation } from './operational-attestation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): NextResponse {
  const attestation = createK2VercelOperationalAttestation();
  if (!attestation) {
    return NextResponse.json(
      { error: 'Operational deployment attestation is unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  return NextResponse.json(attestation, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
