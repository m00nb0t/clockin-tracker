import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creators } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

// GET /api/admin/creators/[id] - Get single creator
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { id } = await params;
    const creatorId = parseInt(id);

    if (isNaN(creatorId)) {
      return NextResponse.json(
        { error: 'Invalid creator ID' },
        { status: 400 }
      );
    }

    const result = await db.select()
      .from(creators)
      .where(eq(creators.id, creatorId))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error fetching creator:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch creator: ${message}` },
      { status: 400 }
    );
  }
}

// PUT /api/admin/creators/[id] - Update creator
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { id } = await params;
    const creatorId = parseInt(id);

    if (isNaN(creatorId)) {
      return NextResponse.json(
        { error: 'Invalid creator ID' },
        { status: 400 }
      );
    }

    const { name, fanvueUuid, platform, active } = await request.json();

    if (!name || !platform) {
      return NextResponse.json(
        { error: 'Name and platform are required' },
        { status: 400 }
      );
    }

    if (!['fanvue', 'other'].includes(platform)) {
      return NextResponse.json(
        { error: 'Platform must be "fanvue" or "other"' },
        { status: 400 }
      );
    }

    // If platform is fanvue, fanvueUuid is required
    if (platform === 'fanvue' && !fanvueUuid) {
      return NextResponse.json(
        { error: 'Fanvue UUID is required for Fanvue creators' },
        { status: 400 }
      );
    }

    // Check for duplicate fanvueUuid if provided (excluding current creator)
    if (fanvueUuid) {
      const existing = await db.select()
        .from(creators)
        .where(and(
          eq(creators.fanvueUuid, fanvueUuid),
          sql`${creators.id} != ${creatorId}`
        ))
        .limit(1);

      if (existing[0]) {
        return NextResponse.json(
          { error: 'A creator with this Fanvue UUID already exists' },
          { status: 400 }
        );
      }
    }

    // Update creator
    await db
      .update(creators)
      .set({
        name: name.trim(),
        fanvueUuid: fanvueUuid?.trim() || null,
        platform,
        active: active !== undefined ? active : true,
      })
      .where(eq(creators.id, creatorId));

    const result = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
    
    if (!result[0]) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error updating creator:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to update creator: ${message}` },
      { status: 400 }
    );
  }
}

// DELETE /api/admin/creators/[id] - Deactivate creator (soft delete)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { id } = await params;
    const creatorId = parseInt(id);

    if (isNaN(creatorId)) {
      return NextResponse.json(
        { error: 'Invalid creator ID' },
        { status: 400 }
      );
    }

    // Soft delete by setting active to false
    await db
      .update(creators)
      .set({ active: false })
      .where(eq(creators.id, creatorId));

    return NextResponse.json({
      success: true,
      message: 'Creator deactivated successfully'
    });
  } catch (error: unknown) {
    console.error('Error deactivating creator:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to deactivate creator: ${message}` },
      { status: 400 }
    );
  }
}
