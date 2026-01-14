import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions, quizSettings } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';


function getDaysSinceStart(startDateStr: string, timezone: string = 'Asia/Shanghai'): number {
  const startDate = new Date(startDateStr + 'T00:00:00');
  const now = new Date();

  // Convert to target timezone
  const timezoneOffset = timezone === 'Asia/Shanghai' ? 8 * 60 : 0;
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const currentDate = new Date(utcTime + (timezoneOffset * 60000));

  // Calculate days difference
  const diffTime = currentDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays + 1); // +1 because day 1 starts on start date
}

export async function GET() {
  try {
    // Get quiz settings
    const settings = await db
      .select()
      .from(quizSettings)
      .orderBy(desc(quizSettings.updatedAt))
      .limit(1);

    if (settings.length === 0) {
      return NextResponse.json({ error: 'Quiz settings not configured' }, { status: 400 });
    }

    const quizConfig = settings[0];
    const daysSinceStart = getDaysSinceStart(quizConfig.startDate, quizConfig.timezone);

    // Get all active questions ordered by sequence
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.active, true))
      .orderBy(quizQuestions.sequenceNumber);

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No active questions' }, { status: 404 });
    }

    // Calculate which question should be active today
    const questionIndex = Math.max(0, (daysSinceStart - 1) % questions.length); // Ensure non-negative
    const todaysQuestion = questions[questionIndex];

    if (!todaysQuestion) {
      return NextResponse.json({ error: 'No question available for today' }, { status: 404 });
    }

    return NextResponse.json({
      id: todaysQuestion.id,
      sequenceNumber: todaysQuestion.sequenceNumber,
      question: todaysQuestion.question,
      optionA: todaysQuestion.optionA,
      optionB: todaysQuestion.optionB,
      optionC: todaysQuestion.optionC,
      optionD: todaysQuestion.optionD,
      correctAnswer: todaysQuestion.correctAnswer,
      explanation: todaysQuestion.explanation,
      dayNumber: daysSinceStart,
      totalQuestions: questions.length,
    });
  } catch (error: unknown) {
    console.error('Error fetching daily question:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 400 });
  }
}
