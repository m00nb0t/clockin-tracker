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
      .select({
        id: quizSettings.id,
        startDate: quizSettings.startDate,
        timezone: quizSettings.timezone,
        updatedAt: quizSettings.updatedAt,
      })
      .from(quizSettings)
      .orderBy(desc(quizSettings.updatedAt))
      .limit(1);

    if (settings.length === 0) {
      // Create default settings
      await db
        .insert(quizSettings)
        .values({
          startDate: formatGmt8Date(), // Today
          timezone: 'Asia/Shanghai',
        });

      const defaultSettings = await db.select({
        id: quizSettings.id,
        startDate: quizSettings.startDate,
        timezone: quizSettings.timezone,
        updatedAt: quizSettings.updatedAt,
      }).from(quizSettings).limit(1);

      return NextResponse.json(defaultSettings[0]);
    }

    return NextResponse.json(settings[0]);
  } catch (error: unknown) {
    console.error('Error fetching quiz settings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}

// PUT /api/admin/quiz/settings - Update quiz settings
export async function PUT(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const body = await request.json();
    const { startDate, timezone } = body;

    if (!startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      );
    }

    // Sanitize startDate to YYYY-MM-DD
    const sanitizedStartDate = startDate.split('T')[0];

    // Check if settings exist
    const existing = await db.select().from(quizSettings).limit(1);

    let result;
    if (existing.length > 0) {
      // Update existing settings
      await db
        .update(quizSettings)
        .set({
          startDate: sanitizedStartDate,
          timezone: timezone || 'Asia/Shanghai',
          updatedAt: new Date(),
        })
        .where(eq(quizSettings.id, existing[0].id));
      
      // Fetch the updated record
      const updated = await db.select({
        id: quizSettings.id,
        startDate: quizSettings.startDate,
        timezone: quizSettings.timezone,
        updatedAt: quizSettings.updatedAt,
      }).from(quizSettings).where(eq(quizSettings.id, existing[0].id)).limit(1);
      result = updated;
    } else {
      // Insert new settings
      await db
        .insert(quizSettings)
        .values({
          startDate: sanitizedStartDate,
          timezone: timezone || 'Asia/Shanghai',
        });
      
      // Fetch the new record
      const inserted = await db.select({
        id: quizSettings.id,
        startDate: quizSettings.startDate,
        timezone: quizSettings.timezone,
        updatedAt: quizSettings.updatedAt,
      }).from(quizSettings).orderBy(desc(quizSettings.id)).limit(1);
      result = inserted;
    }

    if (!result[0]) {
      throw new Error('Failed to save settings to database');
    }

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error updating quiz settings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Update failed: ${message}` },
      { status: 500 }
    );
  }
}
