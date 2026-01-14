import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

// GET /api/admin/quiz - List all quiz questions
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);

    const questions = await db
      .select()
      .from(quizQuestions)
      .orderBy(desc(quizQuestions.createdAt));

    return NextResponse.json(questions);
  } catch (error: any) {
    console.error('Error fetching quiz questions:', error);
    return NextResponse.json(
      { error: `Failed to fetch quiz questions: ${error.message || 'Unknown error'}` },
      { status: 400 }
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
    const result = await db
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
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Error creating quiz question:', error);
    return NextResponse.json(
      { error: `Failed to create quiz question: ${error.message || 'Unknown error'}` },
      { status: 400 }
    );
  }
}
