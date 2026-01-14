import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions, quizAttempts } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAdminDashboard } from '@/lib/auth';

// GET /api/admin/quiz/[id] - Get single quiz question
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { id } = await params;
    const questionId = parseInt(id);

    const question = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.id, questionId))
      .limit(1);

    if (!question[0]) {
      return NextResponse.json(
        { error: 'Quiz question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(question[0]);
  } catch (error: any) {
    console.error('Error fetching quiz question:', error);
    return NextResponse.json(
      { error: `Failed to fetch quiz question: ${error.message || 'Unknown error'}` },
      { status: 400 }
    );
  }
}

// PUT /api/admin/quiz/[id] - Update quiz question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { id } = await params;
    const questionId = parseInt(id);
    const { question, optionA, optionB, optionC, optionD, correctAnswer, explanation, active } = await request.json();

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

    // Update quiz question (Sequence number is kept the same to avoid messing up the schedule)
    const result = await db
      .update(quizQuestions)
      .set({
        question: question.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        optionC: optionC.trim(),
        optionD: optionD.trim(),
        correctAnswer,
        explanation: explanation?.trim() || null,
        active: active !== undefined ? active : true,
      })
      .where(eq(quizQuestions.id, questionId))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { error: 'Quiz question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Error updating quiz question:', error);
    return NextResponse.json(
      { error: `Failed to update quiz question: ${error.message || 'Unknown error'}` },
      { status: 400 }
    );
  }
}

// DELETE /api/admin/quiz/[id] - Delete quiz question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    const { id } = await params;
    const questionId = parseInt(id);

    // Check if question exists
    const question = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.id, questionId))
      .limit(1);

    if (!question[0]) {
      return NextResponse.json(
        { error: 'Quiz question not found' },
        { status: 404 }
      );
    }

    // Check if question has been used in attempts
    const attempts = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.questionId, questionId))
      .limit(1);

    if (attempts[0]) {
      // Soft delete - set inactive
      await db
        .update(quizQuestions)
        .set({ active: false })
        .where(eq(quizQuestions.id, questionId));

      return NextResponse.json({
        success: true,
        message: 'Question deactivated (has been used in attempts)'
      });
    } else {
      // Hard delete - remove completely
      await db
        .delete(quizQuestions)
        .where(eq(quizQuestions.id, questionId));

      return NextResponse.json({
        success: true,
        message: 'Question deleted permanently'
      });
    }
  } catch (error: any) {
    console.error('Error deleting quiz question:', error);
    return NextResponse.json(
      { error: `Failed to delete quiz question: ${error.message || 'Unknown error'}` },
      { status: 400 }
    );
  }
}
