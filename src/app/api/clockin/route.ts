import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, clockIns } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get employee
    const employeeResult = await db.select().from(employees).where(eq(employees.telegramId, userId)).limit(1);
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
        sql`date(${clockIns.date}) < date('${today}')`
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
    await db.insert(clockIns).values({
      employeeId: employee.id,
      clockInTime: now,
      date: today,
    });

    return NextResponse.json({ success: true, message: 'Clocked in successfully' });
  } catch (error) {
    console.error('Clock-in error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
