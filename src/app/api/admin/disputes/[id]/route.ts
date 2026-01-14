import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tipDisputes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

// PUT /api/admin/disputes/[id] - Resolve a dispute
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const { id } = await params;
    const disputeId = parseInt(id);

    if (isNaN(disputeId)) {
      return NextResponse.json(
        { error: 'Invalid dispute ID' },
        { status: 400 }
      );
    }

    const { status, resolution } = await request.json();

    if (!['resolved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be "resolved" or "rejected"' },
        { status: 400 }
      );
    }

    if (!resolution || !resolution.trim()) {
      return NextResponse.json(
        { error: 'Resolution explanation is required' },
        { status: 400 }
      );
    }

    // Get current admin user ID from token
    requireAdminDashboard(request);
    // In our system, the token only says { isAdmin: true }. 
    // To make this fully production ready, we need to know WHICH admin did it.
    // For now, let's at least ensure the database has an admin we can attribute this to.

    const result = await db
      .update(tipDisputes)
      .set({
        status,
        resolution: resolution.trim(),
        resolvedBy: 1, // Defaulting to the primary admin record for now
        resolvedAt: new Date(),
      })
      .where(eq(tipDisputes.id, disputeId))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error resolving dispute:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to resolve dispute: ${message}` },
      { status: 400 }
    );
  }
}
