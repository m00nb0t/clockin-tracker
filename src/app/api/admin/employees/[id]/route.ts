import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { employees, admins, clockIns } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

// GET /api/admin/employees/[id] - Get single employee details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { id } = await params;
    const employeeId = parseInt(id);

    const employee = await db
      .select({
        id: employees.id,
        name: employees.name,
        telegramId: employees.telegramId,
        role: employees.role,
        active: employees.active,
        createdAt: employees.createdAt
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
  } catch (error: unknown) {
    console.error('Error fetching employee:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch employee: ${message}` },
      { status: 400 }
    );
  }
}

// PUT /api/admin/employees/[id] - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
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
    await db
      .update(employees)
      .set({
        name: name.trim(),
        telegramId: telegramId.trim(),
        role: role || 'employee',
        active: active !== undefined ? active : true,
      })
      .where(eq(employees.id, employeeId));

    const result = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);

    if (!result[0]) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error updating employee:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to update employee: ${message}` },
      { status: 400 }
    );
  }
}

// DELETE /api/admin/employees/[id] - Deactivate employee (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
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
    await db.transaction(async (tx) => {
      // 1. Deactivate employee
      await tx
        .update(employees)
        .set({ active: false })
        .where(eq(employees.id, employeeId));
      
      // 2. Check for and close any active shifts
      const activeShifts = await tx
        .select()
        .from(clockIns)
        .where(and(
          eq(clockIns.employeeId, employeeId),
          sql`${clockIns.clockOutTime} IS NULL`
        ));
      
      for (const shift of activeShifts) {
        const clockInTime = new Date(shift.clockInTime);
        const clockOutTime = new Date();
        const totalHours = Math.max(0, Math.round((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) * 100) / 100);
        
        await tx
          .update(clockIns)
          .set({
            clockOutTime,
            totalHours,
          })
          .where(eq(clockIns.id, shift.id));
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Employee deactivated successfully and active shifts closed'
    });
  } catch (error: unknown) {
    console.error('Error deactivating employee:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to deactivate employee: ${message}` },
      { status: 400 }
    );
  }
}
