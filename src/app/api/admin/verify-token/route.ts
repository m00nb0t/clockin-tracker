import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDashboard } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify admin token
    requireAdminDashboard(request);
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
