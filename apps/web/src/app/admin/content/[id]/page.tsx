'use client';

import { useParams } from 'next/navigation';
import { AdminContentDetail } from '../../../../features/admin/AdminContentDetail';

export default function AdminContentPage() {
  const params = useParams<{ id: string }>();
  return <AdminContentDetail contentId={params.id} />;
}
