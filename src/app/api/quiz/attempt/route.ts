import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizAttempts, employees } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { userId, questionId, selectedAnswer, correct, attemptNumber } = await request.json();

    if (!userId || !questionId || !selectedAnswer) {
      return NextResponse.json(
        { error: 'User ID, question ID, and selected answer are required' },
        { status: 400 }
      );
    }

    // Get employee
    const employeeResult = await db
      .select()
      .from(employees)
      .where(eq(employees.telegramId, userId))
      .limit(1);

    if (!employeeResult[0]) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Calculate attempt number for this employee-question pair
    const existingAttempts = await db
      .select()
      .from(quizAttempts)
      .where(and(
        eq(quizAttempts.employeeId, employeeResult[0].id),
        eq(quizAttempts.questionId, questionId)
      ));

    const actualAttemptNumber = existingAttempts.length + 1;

    // Record quiz attempt
    const result = await db
      .insert(quizAttempts)
      .values({
        employeeId: employeeResult[0].id,
        questionId,
        selectedAnswer,
        correct: correct || false,
        attemptNumber: actualAttemptNumber,
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error recording quiz attempt:', error);
    return NextResponse.json(
      { error: 'Failed to record quiz attempt' },
      { status: 500 }
    );
  }
}

// GET /api/quiz/attempt?employeeId=X&questionId=Y - Get attempts for analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const questionId = searchParams.get('questionId');

    if (!employeeId || !questionId) {
      return NextResponse.json(
        { error: 'Employee ID and question ID are required' },
        { status: 400 }
      );
    }

    const attempts = await db
      .select({
        id: quizAttempts.id,
        selectedAnswer: quizAttempts.selectedAnswer,
        correct: quizAttempts.correct,
        attemptNumber: quizAttempts.attemptNumber,
        attemptedAt: quizAttempts.attemptedAt,
      })
      .from(quizAttempts)
      .where(and(
        eq(quizAttempts.employeeId, parseInt(employeeId)),
        eq(quizAttempts.questionId, parseInt(questionId))
      ))
      .orderBy(quizAttempts.attemptNumber);

    return NextResponse.json(attempts);
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz attempts' },
      { status: 500 }
    );
  }
}
