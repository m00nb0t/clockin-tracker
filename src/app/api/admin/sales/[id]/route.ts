import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sales, employees } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/admin/sales/[id] - Get single sales entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const salesId = parseInt(id);

    const salesEntry = await db
      .select({
        id: sales.id,
        employeeId: sales.employeeId,
        employeeName: employees.name,
        category: sales.category,
        amount: sales.amount,
        date: sales.date,
        description: sales.description,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(employees, eq(sales.employeeId, employees.id))
      .where(eq(sales.id, salesId))
      .limit(1);

    if (!salesEntry[0]) {
      return NextResponse.json(
        { error: 'Sales entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(salesEntry[0]);
  } catch (error) {
    console.error('Error fetching sales entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales entry' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/sales/[id] - Update sales entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const salesId = parseInt(id);
    const { employeeId, category, amount, date, description } = await request.json();

    if (!employeeId || !category || !amount || !date) {
      return NextResponse.json(
        { error: 'Employee, category, amount, and date are required' },
        { status: 400 }
      );
    }

    if (!['tip', 'ppv'].includes(category)) {
      return NextResponse.json(
        { error: 'Category must be "tip" or "ppv"' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Verify employee exists and is active
    const employee = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.id, employeeId),
        eq(employees.active, true)
      ))
      .limit(1);

    if (!employee[0]) {
      return NextResponse.json(
        { error: 'Employee not found or inactive' },
        { status: 400 }
      );
    }

    // Update sales entry
    const result = await db
      .update(sales)
      .set({
        employeeId,
        category,
        amount: parseFloat(amount),
        date,
        description: description?.trim() || null,
      })
      .where(eq(sales.id, salesId))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { error: 'Sales entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating sales entry:', error);
    return NextResponse.json(
      { error: 'Failed to update sales entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sales/[id] - Delete sales entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const salesId = parseInt(id);

    // Check if sales entry exists
    const salesEntry = await db
      .select()
      .from(sales)
      .where(eq(sales.id, salesId))
      .limit(1);

    if (!salesEntry[0]) {
      return NextResponse.json(
        { error: 'Sales entry not found' },
        { status: 404 }
      );
    }

    // Delete sales entry
    await db
      .delete(sales)
      .where(eq(sales.id, salesId));

    return NextResponse.json({
      success: true,
      message: 'Sales entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sales entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete sales entry' },
      { status: 500 }
    );
  }
}
