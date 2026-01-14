import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, admins } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

// GET /api/admin/employees - List all employees with admin status
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const employeeList = await db
      .select({
        id: employees.id,
        name: employees.name,
        telegramId: employees.telegramId,
        role: employees.role,
        active: employees.active,
        createdAt: employees.createdAt,
        isAdmin: sql<boolean>`CASE WHEN ${admins.id} IS NOT NULL THEN true ELSE false END`
      })
      .from(employees)
      .leftJoin(admins, eq(employees.id, admins.employeeId))
      .orderBy(employees.createdAt);

    return NextResponse.json(employeeList);
  } catch (error: unknown) {
    console.error('Error fetching employees:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/admin/employees - Create new employee
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const { name, telegramId } = await request.json();

    if (!name || !telegramId) {
      return NextResponse.json(
        { error: 'Name and Telegram ID are required' },
        { status: 400 }
      );
    }

    // Check if telegram ID already exists
    const existing = await db
      .select()
      .from(employees)
      .where(eq(employees.telegramId, telegramId))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(
        { error: 'Telegram ID already exists' },
        { status: 400 }
      );
    }

    // Create employee
    const result = await db
      .insert(employees)
      .values({
        name: name.trim(),
        telegramId: telegramId.trim(),
        role: 'employee',
        active: true,
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error creating employee:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}
