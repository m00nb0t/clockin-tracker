import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creators } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/creators - Get active creators for clock-in selection
export async function GET() {
  try {
    const creatorsList = await db
      .select({
        id: creators.id,
        name: creators.name,
        platform: creators.platform,
      })
      .from(creators)
      .where(eq(creators.active, true))
      .orderBy(creators.name);

    return NextResponse.json({
      creators: creatorsList
    });
  } catch (error: any) {
    console.error('Error fetching creators:', error);
    return NextResponse.json(
      { error: `Failed to fetch creators: ${error.message || 'Unknown'}` },
      { status: 400 }
    );
  }
}
