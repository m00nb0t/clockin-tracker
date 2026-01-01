import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.active, true));

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No active questions' }, { status: 404 });
    }

    // Get random question
    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];

    return NextResponse.json({
      id: question.id,
      question: question.question,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
    });
  } catch (error) {
    console.error('Error fetching random question:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
