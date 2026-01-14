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

    // 1. Get the existing record to find the clockInTime
    const existing = await db
      .select()
      .from(clockIns)
      .where(eq(clockIns.id, clockInId))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json(
        { error: 'Clock-in record not found' },
        { status: 404 }
      );
    }

    const clockInTime = new Date(existing[0].clockInTime);
    const correctedClockOut = new Date(clockOutTime);
    
    // 2. Calculate the corrected total hours
    const totalHours = Math.round((correctedClockOut.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) * 100) / 100;

    // 3. Update the clock-in record
    await db
      .update(clockIns)
      .set({
        clockOutTime: correctedClockOut,
        totalHours: totalHours,
      })
      .where(eq(clockIns.id, clockInId));

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
