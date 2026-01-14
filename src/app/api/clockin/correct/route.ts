import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clockIns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const { clockInId, clockOutTime } = await request.json();

    if (!clockInId || !clockOutTime) {
      return NextResponse.json(
        { error: 'Clock-in ID and clock-out time are required' },
        { status: 400 }
      );
    }

    // Update the clock-in record with corrected clock-out time
    const result = await db
      .update(clockIns)
      .set({
        clockOutTime: new Date(clockOutTime),
      })
      .where(eq(clockIns.id, clockInId))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { error: 'Clock-in record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Clock-out time corrected successfully'
    });
  } catch (error: unknown) {
    console.error('Error correcting clock-out time:', error);
    const message = error instanceof Error ? error.message : 'Unknown';
    return NextResponse.json(
      { error: `Failed to correct clock-out time: ${message}` },
      { status: 400 }
    );
  }
}
