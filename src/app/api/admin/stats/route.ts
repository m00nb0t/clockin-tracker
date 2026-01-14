import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, clockIns, sales } from '@/lib/db/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';
import { formatGmt8Date, getGmt8Date } from '@/lib/dateUtils';

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    // Get total employees
    const totalEmployeesResult = await db.select({ count: sql<number>`count(*)` }).from(employees);
    const totalEmployees = totalEmployeesResult[0].count;

    // Get active employees (clocked in today or recently)
    const today = formatGmt8Date();

    const activeEmployeesResult = await db.select({ count: sql<number>`count(distinct ${clockIns.employeeId})` })
      .from(clockIns)
      .where(eq(clockIns.date, today));
    const todayClockIns = activeEmployeesResult[0].count;

    // Get today's sales total
    const todaySalesResult = await db.select({ total: sql<number>`coalesce(sum(${sales.amount}), 0)` })
      .from(sales)
      .where(eq(sales.date, today));
    const todaySales = todaySalesResult[0].total;

    // Get this week's hours and sales (GMT+8)
    // In GMT+8, we want to find the most recent Monday at midnight
    const nowGmt8 = getGmt8Date();
    const dayOfWeek = nowGmt8.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday(0), subtract 6 to get to last Monday
    
    const weekStart = new Date(nowGmt8);
    weekStart.setUTCDate(nowGmt8.getUTCDate() - daysToSubtract);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const weekHoursResult = await db.select({ total: sql<number>`coalesce(sum(${clockIns.totalHours}), 0)` })
      .from(clockIns)
      .where(and(
        gte(clockIns.date, weekStartStr),
        lte(clockIns.date, weekEndStr)
      ));
    const thisWeekHours = weekHoursResult[0].total;

    const weekSalesResult = await db.select({ total: sql<number>`coalesce(sum(${sales.amount}), 0)` })
      .from(sales)
      .where(and(
        gte(sales.date, weekStartStr),
        lte(sales.date, weekEndStr)
      ));
    const thisWeekSales = weekSalesResult[0].total;

    return NextResponse.json({
      totalEmployees,
      activeEmployees: todayClockIns,
      todayClockIns,
      todaySales,
      thisWeekHours,
      thisWeekSales,
    });
  } catch (error: unknown) {
    console.error('Error fetching admin stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch stats: ${message}` }, { status: 400 });
  }
}
