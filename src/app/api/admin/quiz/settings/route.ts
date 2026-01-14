import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizSettings } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';
import { formatGmt8Date } from '@/lib/dateUtils';

// GET /api/admin/quiz/settings - Get current quiz settings
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const settings = await db
      .select()
      .from(quizSettings)
      .orderBy(desc(quizSettings.updatedAt))
      .limit(1);

    if (settings.length === 0) {
      // Create default settings
      const defaultSettings = await db
        .insert(quizSettings)
        .values({
          startDate: formatGmt8Date(), // Today
          timezone: 'Asia/Shanghai',
        })
        .returning();

      return NextResponse.json(defaultSettings[0]);
    }

    return NextResponse.json(settings[0]);
  } catch (error: unknown) {
    console.error('Error fetching quiz settings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch quiz settings: ${message}` },
      { status: 400 }
    );
  }
}

// PUT /api/admin/quiz/settings - Update quiz settings
export async function PUT(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const { startDate, timezone } = await request.json();

    if (!startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      );
    }

    // Check if settings exist
    const existing = await db.select().from(quizSettings).limit(1);

    let result;
    if (existing.length > 0) {
      // Update existing settings
      result = await db
        .update(quizSettings)
        .set({
          startDate,
          timezone: timezone || 'Asia/Shanghai',
          updatedAt: new Date(),
        })
        .where(eq(quizSettings.id, existing[0].id))
        .returning();
    } else {
      // Create new settings
      result = await db
        .insert(quizSettings)
        .values({
          startDate,
          timezone: timezone || 'Asia/Shanghai',
        })
        .returning();
    }

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error updating quiz settings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to update quiz settings: ${message}` },
      { status: 400 }
    );
  }
}
