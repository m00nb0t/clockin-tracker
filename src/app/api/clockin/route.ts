import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, clockIns, clockInCreators, creators } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { formatGmt8Date } from '@/lib/dateUtils';

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

    const today = formatGmt8Date();
    const now = new Date();

    // Check if they already have an active clock-in (any day)
    const activeClockIn = await db.select()
      .from(clockIns)
      .where(and(
        eq(clockIns.employeeId, employee.id),
        sql`${clockIns.clockOutTime} IS NULL`
      ))
      .orderBy(desc(clockIns.clockInTime))
      .limit(1);

    if (activeClockIn[0]) {
      const clockInTime = new Date(activeClockIn[0].clockInTime);
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      // If they forgot to clock out from a previous day, or have a very long shift
      if (hoursWorked > 14) {
        return NextResponse.json({
          error: 'Forgot to clock out?',
          message: `You appear to have forgotten to clock out from ${activeClockIn[0].date}. This would result in ${hoursWorked.toFixed(1)} hours worked.`,
          requiresClockOut: true,
          openClockIn: {
            id: activeClockIn[0].id,
            date: activeClockIn[0].date,
            clockInTime: activeClockIn[0].clockInTime
          }
        }, { status: 400 });
      }

      // Normal case: already clocked in
      return NextResponse.json({ 
        error: 'Already clocked in',
        message: 'You currently have an active shift. Please clock out before starting a new one.'
      }, { status: 400 });
    }

    // Create clock-in record within a transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Re-verify inside transaction to prevent race conditions
      const doubleCheck = await tx.select()
        .from(clockIns)
        .where(and(
          eq(clockIns.employeeId, employee.id),
          sql`${clockIns.clockOutTime} IS NULL`
        ))
        .limit(1);
      
      if (doubleCheck[0]) {
        throw new Error('Concurrent clock-in detected');
      }

      const clockIn = await tx.insert(clockIns).values({
        employeeId: employee.id,
        clockInTime: now,
        date: today,
      });

      // Since we can't reliably use .returning() on SQLite in some environments,
      // and we need the ID for creator associations, fetch the latest ID for this employee
      const inserted = await tx.select({ id: clockIns.id })
        .from(clockIns)
        .where(eq(clockIns.employeeId, employee.id))
        .orderBy(desc(clockIns.id))
        .limit(1);
      
      return inserted[0];
    });

    const clockInId = result.id;

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
  } catch (error: unknown) {
    console.error('Clock-in error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 });
  }
}
