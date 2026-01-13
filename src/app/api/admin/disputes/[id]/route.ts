import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tipDisputes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

// PUT /api/admin/disputes/[id] - Resolve a dispute
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require admin authentication
    await requireAdmin(request);

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

    // For now, we'll assume the resolver is admin user ID 1
    // In a real app, you'd get this from authentication
    const resolverId = 1;

    const result = await db
      .update(tipDisputes)
      .set({
        status,
        resolution: resolution.trim(),
        resolvedBy: resolverId,
        resolvedAt: new Date() as any, // Force type for now
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
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return NextResponse.json(
      { error: 'Failed to resolve dispute' },
      { status: 500 }
    );
  }
}
