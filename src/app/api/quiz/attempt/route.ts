import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizAttempts, employees } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireUser, requireAdminDashboard } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require user authentication
    const authUser = await requireUser(request);

    const { questionId, selectedAnswer, correct } = await request.json();

    if (!questionId || !selectedAnswer) {
      return NextResponse.json(
        { error: 'Question ID and selected answer are required' },
        { status: 400 }
      );
    }

    // Use authenticated user
    const employeeResult = await db
      .select()
      .from(employees)
      .where(eq(employees.id, authUser.id))
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
    await db
      .insert(quizAttempts)
      .values({
        employeeId: employeeResult[0].id,
        questionId,
        selectedAnswer,
        correct: correct || false,
        attemptNumber: actualAttemptNumber,
      });

    const result = await db.select().from(quizAttempts)
      .where(and(
        eq(quizAttempts.employeeId, employeeResult[0].id),
        eq(quizAttempts.questionId, questionId)
      ))
      .orderBy(desc(quizAttempts.id))
      .limit(1);

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error recording quiz attempt:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to record quiz attempt: ${message}` },
      { status: 400 }
    );
  }
}

// GET /api/quiz/attempt?employeeId=X&questionId=Y - Get attempts for analytics
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for viewing analytics
    requireAdminDashboard(request);
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
  } catch (error: unknown) {
    console.error('Error fetching quiz attempts:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch quiz attempts: ${message}` },
      { status: 400 }
    );
  }
}
