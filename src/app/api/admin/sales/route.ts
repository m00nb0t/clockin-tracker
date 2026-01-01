import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sales, employees } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

// GET /api/admin/sales - List all sales with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereConditions = [];

    if (employeeId) {
      whereConditions.push(eq(sales.employeeId, parseInt(employeeId)));
    }

    if (category) {
      whereConditions.push(eq(sales.category, category));
    }

    if (startDate) {
      whereConditions.push(gte(sales.date, startDate));
    }

    if (endDate) {
      whereConditions.push(lte(sales.date, endDate));
    }

    const salesList = await db
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
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(sales.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sales)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const total = totalResult[0].count;

    return NextResponse.json({
      sales: salesList,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

// POST /api/admin/sales - Create new sales entry
export async function POST(request: NextRequest) {
  try {
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

    // Create sales entry
    const result = await db
      .insert(sales)
      .values({
        employeeId,
        category,
        amount: parseFloat(amount),
        date,
        description: description?.trim() || null,
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating sales entry:', error);
    return NextResponse.json(
      { error: 'Failed to create sales entry' },
      { status: 500 }
    );
  }
}
