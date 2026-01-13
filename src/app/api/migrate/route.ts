import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminDashboard } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    // Use Drizzle's built-in migration system instead of raw SQL
    return NextResponse.json({
      success: false,
      message: 'Use npm run db:push instead of this endpoint',
      command: 'npm run db:push'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to run database migration',
    usage: 'curl -X POST http://localhost:3000/api/migrate'
  });
}
