import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions, quizSettings } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getGmt8Date } from '@/lib/dateUtils';


function getDaysSinceStart(startDateStr: string, _timezone: string = 'Asia/Shanghai'): number {
  const dateOnly = startDateStr.split('T')[0];
  const startDate = new Date(dateOnly + 'T00:00:00');
  const currentDate = getGmt8Date();

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
    // We use the dayNumber to select the sequenceNumber. 
    // This is stable: Day 1 always shows Sequence 1, regardless of how many questions exist.
    const maxSeqResult = await db.select({ maxSeq: sql<number>`max(${quizQuestions.sequenceNumber})` }).from(quizQuestions).where(eq(quizQuestions.active, true));
    const maxSeq = maxSeqResult[0]?.maxSeq || 1;
    
    const targetSequence = ((daysSinceStart - 1) % maxSeq) + 1;

    const todaysQuestionResult = await db
      .select()
      .from(quizQuestions)
      .where(and(
        eq(quizQuestions.active, true),
        eq(quizQuestions.sequenceNumber, targetSequence)
      ))
      .limit(1);
    
    let todaysQuestion = todaysQuestionResult[0];

    // Fallback: If sequence number has a gap, find the nearest one
    if (!todaysQuestion) {
      const fallbackQuestion = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.active, true))
        .orderBy(quizQuestions.sequenceNumber)
        .limit(1);
      todaysQuestion = fallbackQuestion[0];
    }

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
