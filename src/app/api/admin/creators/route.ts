import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creators } from '@/lib/db/schema';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { sanitizeString, sanitizeUUID } from '@/lib/sanitize';
import { requireAdminDashboard } from '@/lib/auth';

// GET /api/admin/creators - List all creators with filtering
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const platform = searchParams.get('platform');
    const active = searchParams.get('active');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          like(creators.name, `%${search}%`),
          like(creators.fanvueUuid, `%${search}%`)
        )
      );
    }

    if (platform) {
      whereConditions.push(eq(creators.platform, platform));
    }

    if (active !== null) {
      whereConditions.push(eq(creators.active, active === 'true'));
    }

    const creatorsList = await db
      .select()
      .from(creators)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(creators.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(creators)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const total = totalResult[0].count;

    return NextResponse.json({
      creators: creatorsList,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error('Error fetching creators:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch creators: ${message}` },
      { status: 400 }
    );
  }
}

// POST /api/admin/creators - Create new creator or bulk import
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

  const url = new URL(request.url);
  const isBulk = url.searchParams.get('bulk') === 'true';

  if (isBulk) {
    return handleBulkImport(request);
  }

  return handleSingleCreate(request);
  } catch (error: unknown) {
    console.error('Error in POST /api/admin/creators:', error);
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : 'Unknown';
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 400 });
  }
}

async function handleBulkImport(request: NextRequest) {
  try {
    const { creators: creatorsData } = await request.json();

    if (!Array.isArray(creatorsData) || creatorsData.length === 0) {
      return NextResponse.json(
        { error: 'Creators array is required for bulk import' },
        { status: 400 }
      );
    }

    if (creatorsData.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 creators allowed per bulk import' },
        { status: 400 }
      );
    }

    const results = {
      successful: [] as { id: number; name: string; fanvueUuid: string | null; platform: string; active: boolean; createdAt: Date }[],
      failed: [] as { data: { name: string; fanvueUuid?: string; platform: string; active?: boolean }; error: string }[],
    };

    for (let i = 0; i < creatorsData.length; i++) {
      const creatorData = creatorsData[i];

      try {
        // Validate individual creator
        const { name, fanvueUuid, platform, active } = creatorData;

        if (!name || !platform) {
          results.failed.push({
            data: creatorData,
            error: 'Name and platform are required'
          });
          continue;
        }

        if (!['fanvue', 'other'].includes(platform)) {
          results.failed.push({
            data: creatorData,
            error: 'Platform must be "fanvue" or "other"'
          });
          continue;
        }

        if (platform === 'fanvue' && !fanvueUuid) {
          results.failed.push({
            data: creatorData,
            error: 'Fanvue UUID is required for Fanvue creators'
          });
          continue;
        }

        // Check for duplicate fanvueUuid if provided
        if (fanvueUuid) {
          const existing = await db.select()
            .from(creators)
            .where(eq(creators.fanvueUuid, fanvueUuid))
            .limit(1);

          if (existing[0]) {
            results.failed.push({
              data: creatorData,
              error: 'A creator with this Fanvue UUID already exists'
            });
            continue;
          }
        }

        // Create creator
        const result = await db
          .insert(creators)
          .values({
            name: sanitizeString(name, 100),
            fanvueUuid: fanvueUuid ? sanitizeUUID(fanvueUuid) : null,
            platform,
            active: active !== undefined ? active : true,
          })
          .returning();

        results.successful.push(result[0] as { id: number; name: string; fanvueUuid: string | null; platform: string; active: boolean; createdAt: Date });

      } catch (innerError: unknown) {
        const message = innerError instanceof Error ? innerError.message : 'Unknown error';
        results.failed.push({
          data: creatorData,
          error: message
        });
      }
    }

    return NextResponse.json({
      message: `Bulk import completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      results
    });

  } catch (error: unknown) {
    console.error('Error in bulk import:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process bulk import: ${message}` },
      { status: 400 }
    );
  }
}

async function handleSingleCreate(request: NextRequest) {
  try {
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

    // Check for duplicate fanvueUuid if provided
    if (fanvueUuid) {
      const existing = await db.select()
        .from(creators)
        .where(eq(creators.fanvueUuid, fanvueUuid))
        .limit(1);

      if (existing[0]) {
        return NextResponse.json(
          { error: 'A creator with this Fanvue UUID already exists' },
          { status: 400 }
        );
      }
    }

    // Create creator
    const result = await db
      .insert(creators)
      .values({
        name: sanitizeString(name, 100),
        fanvueUuid: fanvueUuid ? sanitizeUUID(fanvueUuid) : null,
        platform,
        active: active !== undefined ? active : true,
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error creating creator:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create creator: ${message}` },
      { status: 400 }
    );
  }
}
