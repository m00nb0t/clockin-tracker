import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, clockIns, sales } from '@/lib/db/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';

export async function GET() {
  try {
    // Get total employees
    const totalEmployeesResult = await db.select({ count: sql<number>`count(*)` }).from(employees);
    const totalEmployees = totalEmployeesResult[0].count;

    // Get active employees (clocked in today or recently)
    const today = new Date().toISOString().split('T')[0];
    const activeEmployeesResult = await db.select({ count: sql<number>`count(distinct ${clockIns.employeeId})` })
      .from(clockIns)
      .where(eq(clockIns.date, today));
    const todayClockIns = activeEmployeesResult[0].count;

    // Get today's sales total
    const todaySalesResult = await db.select({ total: sql<number>`coalesce(sum(${sales.amount}), 0)` })
      .from(sales)
      .where(eq(sales.date, today));
    const todaySales = todaySalesResult[0].total;

    // Get this week's hours and sales
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay())); // End of week (Saturday)
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
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
