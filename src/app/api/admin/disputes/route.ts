import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tipDisputes, fanvueTips, employees, creators, admins } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/disputes - List all disputes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereConditions = [];

    if (status) {
      whereConditions.push(eq(tipDisputes.status, status));
    }

    const disputesList = await db
      .select({
        id: tipDisputes.id,
        tipId: tipDisputes.tipId,
        tipAmount: fanvueTips.amount,
        tipTimestamp: fanvueTips.timestamp,
        creatorName: creators.name,
        disputedByName: employees.name,
        reason: tipDisputes.reason,
        status: tipDisputes.status,
        createdAt: tipDisputes.createdAt,
        resolvedByName: admins.permissions, // This will be null for unresolved disputes
        resolution: tipDisputes.resolution,
      })
      .from(tipDisputes)
      .innerJoin(fanvueTips, eq(tipDisputes.tipId, fanvueTips.id))
      .innerJoin(creators, eq(fanvueTips.recipientUuid, creators.fanvueUuid))
      .innerJoin(employees, eq(tipDisputes.disputedBy, employees.id))
      .leftJoin(admins, eq(tipDisputes.resolvedBy, admins.employeeId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(tipDisputes.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      disputes: disputesList,
    });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}
