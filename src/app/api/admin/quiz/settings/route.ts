import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizSettings } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/admin/quiz/settings - Get current quiz settings
export async function GET() {
  try {
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
          startDate: new Date().toISOString().split('T')[0], // Today
          timezone: 'Asia/Shanghai',
        })
        .returning();

      return NextResponse.json(defaultSettings[0]);
    }

    return NextResponse.json(settings[0]);
  } catch (error) {
    console.error('Error fetching quiz settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz settings' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/quiz/settings - Update quiz settings
export async function PUT(request: NextRequest) {
  try {
    const { startDate, timezone } = await request.json();

    if (!startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      );
    }

    // Update or insert settings
    const result = await db
      .insert(quizSettings)
      .values({
        startDate,
        timezone: timezone || 'Asia/Shanghai',
      })
      .onConflictDoUpdate({
        target: quizSettings.id,
        set: {
          startDate,
          timezone: timezone || 'Asia/Shanghai',
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating quiz settings:', error);
    return NextResponse.json(
      { error: 'Failed to update quiz settings' },
      { status: 500 }
    );
  }
}
