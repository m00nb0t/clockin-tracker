import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions } from '@/lib/db/schema';
import { desc, sql, eq } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

// GET /api/admin/quiz - List all quiz questions
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const questions = await db
      .select({
        id: quizQuestions.id,
        sequenceNumber: quizQuestions.sequenceNumber,
        question: quizQuestions.question,
        optionA: quizQuestions.optionA,
        optionB: quizQuestions.optionB,
        optionC: quizQuestions.optionC,
        optionD: quizQuestions.optionD,
        correctAnswer: quizQuestions.correctAnswer,
        explanation: quizQuestions.explanation,
        active: quizQuestions.active,
        createdAt: quizQuestions.createdAt,
      })
      .from(quizQuestions)
      .orderBy(quizQuestions.sequenceNumber);

    return NextResponse.json(questions);
  } catch (error: unknown) {
    console.error('Error fetching quiz questions:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/admin/quiz - Create new quiz question
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const { question, optionA, optionB, optionC, optionD, correctAnswer, explanation } = await request.json();

    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      return NextResponse.json(
        { error: 'All question fields are required except explanation' },
        { status: 400 }
      );
    }

    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      return NextResponse.json(
        { error: 'Correct answer must be A, B, C, or D' },
        { status: 400 }
      );
    }

    // Auto-calculate sequence number (find max and add 1)
    const maxSequence = await db
      .select({ maxSeq: sql<number>`max(${quizQuestions.sequenceNumber})` })
      .from(quizQuestions);
    
    const nextSequence = (maxSequence[0]?.maxSeq || 0) + 1;

    // Create quiz question
    await db
      .insert(quizQuestions)
      .values({
        sequenceNumber: nextSequence,
        question: question.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        optionC: optionC.trim(),
        optionD: optionD.trim(),
        correctAnswer,
        explanation: explanation?.trim() || null,
        active: true,
      });

    // Fetch the inserted record to ensure correct mapping
    const result = await db
      .select({
        id: quizQuestions.id,
        sequenceNumber: quizQuestions.sequenceNumber,
        question: quizQuestions.question,
        optionA: quizQuestions.optionA,
        optionB: quizQuestions.optionB,
        optionC: quizQuestions.optionC,
        optionD: quizQuestions.optionD,
        correctAnswer: quizQuestions.correctAnswer,
        explanation: quizQuestions.explanation,
        active: quizQuestions.active,
        createdAt: quizQuestions.createdAt,
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.sequenceNumber, nextSequence))
      .limit(1);

    return NextResponse.json(result[0]);
  } catch (error: unknown) {
    console.error('Error creating quiz question:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}
