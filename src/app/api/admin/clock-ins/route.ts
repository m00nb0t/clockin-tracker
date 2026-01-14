import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clockIns, employees } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    requireAdminDashboard(request);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereConditions = [];

    if (employeeId) {
      whereConditions.push(eq(clockIns.employeeId, parseInt(employeeId)));
    }

    if (startDate) {
      whereConditions.push(gte(clockIns.date, startDate));
    }

    if (endDate) {
      whereConditions.push(lte(clockIns.date, endDate));
    }

    const clockInsList = await db
      .select({
        id: clockIns.id,
        employeeId: clockIns.employeeId,
        employeeName: employees.name,
        clockInTime: clockIns.clockInTime,
        clockOutTime: clockIns.clockOutTime,
        date: clockIns.date,
        totalHours: clockIns.totalHours,
      })
      .from(clockIns)
      .leftJoin(employees, eq(clockIns.employeeId, employees.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(clockIns.clockInTime))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(clockIns)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return NextResponse.json({
      clockIns: clockInsList,
      total: totalResult[0].count,
    });
  } catch (error: any) {
    console.error('Error fetching clock-ins:', error);
    return NextResponse.json({ error: `Failed to fetch shift history: ${error.message || 'Unknown error'}` }, { status: 400 });
  }
}

