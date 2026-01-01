import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, admins } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// GET /api/admin/employees - List all employees with admin status
export async function GET() {
  try {
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
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

// POST /api/admin/employees - Create new employee
export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
