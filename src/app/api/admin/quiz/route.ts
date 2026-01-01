import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/admin/quiz - List all quiz questions
export async function GET() {
  try {
    const questions = await db
      .select()
      .from(quizQuestions)
      .orderBy(desc(quizQuestions.createdAt));

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching quiz questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz questions' },
      { status: 500 }
    );
  }
}

// POST /api/admin/quiz - Create new quiz question
export async function POST(request: NextRequest) {
  try {
    const { question, optionA, optionB, optionC, optionD, correctAnswer, explanation } = await request.json();

    if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
      return NextResponse.json(
        { error: 'All fields are required except explanation' },
        { status: 400 }
      );
    }

    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      return NextResponse.json(
        { error: 'Correct answer must be A, B, C, or D' },
        { status: 400 }
      );
    }

    // Create quiz question
    const result = await db
      .insert(quizQuestions)
      .values({
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
  } catch (error) {
    console.error('Error creating quiz question:', error);
    return NextResponse.json(
      { error: 'Failed to create quiz question' },
      { status: 500 }
    );
  }
}
