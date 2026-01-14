import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizAttempts, employees, quizQuestions } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    requireAdminDashboard(request);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const questionId = searchParams.get('questionId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereConditions = [];

    if (employeeId) {
      whereConditions.push(eq(quizAttempts.employeeId, parseInt(employeeId)));
    }

    if (questionId) {
      whereConditions.push(eq(quizAttempts.questionId, parseInt(questionId)));
    }

    const attemptsList = await db
      .select({
        id: quizAttempts.id,
        employeeId: quizAttempts.employeeId,
        employeeName: employees.name,
        questionId: quizAttempts.questionId,
        questionText: quizQuestions.question,
        selectedAnswer: quizAttempts.selectedAnswer,
        correctAnswer: quizQuestions.correctAnswer,
        correct: quizAttempts.correct,
        attemptNumber: quizAttempts.attemptNumber,
        attemptedAt: quizAttempts.attemptedAt,
      })
      .from(quizAttempts)
      .leftJoin(employees, eq(quizAttempts.employeeId, employees.id))
      .leftJoin(quizQuestions, eq(quizAttempts.questionId, quizQuestions.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(quizAttempts.attemptedAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(quizAttempts)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    // Get simple stats: overall correct rate
    const statsResult = await db
      .select({
        total: sql<number>`count(*)`,
        correct: sql<number>`sum(case when ${quizAttempts.correct} = 1 then 1 else 0 end)`
      })
      .from(quizAttempts);

    return NextResponse.json({
      attempts: attemptsList,
      total: totalResult[0].count,
      stats: {
        total: statsResult[0].total,
        correct: statsResult[0].correct,
        rate: statsResult[0].total > 0 ? (statsResult[0].correct / statsResult[0].total) * 100 : 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching quiz attempts:', error);
    return NextResponse.json({ error: `Failed to fetch quiz results: ${error.message || 'Unknown error'}` }, { status: 400 });
  }
}

