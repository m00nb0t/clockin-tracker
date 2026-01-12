import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, clockIns, clockInCreators, creators } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require user authentication
    const authUser = await requireUser(request);

    const { creatorIds } = await request.json();

    // Get employee (should match authenticated user)
    const employeeResult = await db.select().from(employees).where(eq(employees.id, authUser.id)).limit(1);
    const employee = employeeResult[0];

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Check if already clocked in today
    const existingClockIn = await db.select()
      .from(clockIns)
      .where(and(
        eq(clockIns.employeeId, employee.id),
        eq(clockIns.date, today)
      ))
      .limit(1);

    if (existingClockIn[0]) {
      return NextResponse.json({ error: 'Already clocked in today' }, { status: 400 });
    }

    // Check if they have an open clock-in from previous days (forgot to clock out)
    const openClockIn = await db.select()
      .from(clockIns)
      .where(and(
        eq(clockIns.employeeId, employee.id),
        sql`${clockIns.clockOutTime} IS NULL`,
        sql`date(${clockIns.date}) < date(${today})`
      ))
      .orderBy(desc(clockIns.clockInTime))
      .limit(1);

    if (openClockIn[0]) {
      const clockInTime = new Date(openClockIn[0].clockInTime);
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      if (hoursWorked > 14) {
        return NextResponse.json({
          error: 'Forgot to clock out?',
          message: `You appear to have forgotten to clock out from ${openClockIn[0].date}. This would result in ${hoursWorked.toFixed(1)} hours worked.`,
          requiresClockOut: true,
          openClockIn: {
            id: openClockIn[0].id,
            date: openClockIn[0].date,
            clockInTime: openClockIn[0].clockInTime
          }
        }, { status: 400 });
      }
    }

    // Create clock-in record
    const clockInResult = await db.insert(clockIns).values({
      employeeId: employee.id,
      clockInTime: now,
      date: today,
    }).returning();

    const clockInId = clockInResult[0].id;

    // Create clock-in creator associations if provided
    if (creatorIds && Array.isArray(creatorIds) && creatorIds.length > 0) {
      // Validate that all creator IDs exist and are active
      for (const creatorId of creatorIds) {
        const creatorResult = await db.select()
          .from(creators)
          .where(and(
            eq(creators.id, parseInt(creatorId)),
            eq(creators.active, true)
          ))
          .limit(1);

        if (!creatorResult[0]) {
          return NextResponse.json({
            error: `Invalid creator ID: ${creatorId}`
          }, { status: 400 });
        }

        // Create association
        await db.insert(clockInCreators).values({
          clockInId,
          creatorId: parseInt(creatorId),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Clocked in successfully',
      clockInId,
      creatorsSelected: creatorIds?.length || 0
    });
  } catch (error) {
    console.error('Clock-in error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
