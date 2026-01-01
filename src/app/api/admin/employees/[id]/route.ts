import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, admins, clockIns, sales, quizAttempts } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// GET /api/admin/employees/[id] - Get single employee details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    const employee = await db
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
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (!employee[0]) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee[0]);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/employees/[id] - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    const { name, telegramId, role, active } = await request.json();

    if (!name || !telegramId) {
      return NextResponse.json(
        { error: 'Name and Telegram ID are required' },
        { status: 400 }
      );
    }

    // Check if telegram ID already exists for another employee
    const existing = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.telegramId, telegramId),
        sql`${employees.id} != ${employeeId}`
      ))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(
        { error: 'Telegram ID already exists for another employee' },
        { status: 400 }
      );
    }

    // Update employee
    const result = await db
      .update(employees)
      .set({
        name: name.trim(),
        telegramId: telegramId.trim(),
        role: role || 'employee',
        active: active !== undefined ? active : true,
      })
      .where(eq(employees.id, employeeId))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/employees/[id] - Deactivate employee (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    // Check if employee exists
    const employee = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (!employee[0]) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting active to false
    await db
      .update(employees)
      .set({ active: false })
      .where(eq(employees.id, employeeId));

    return NextResponse.json({
      success: true,
      message: 'Employee deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating employee:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate employee' },
      { status: 500 }
    );
  }
}
