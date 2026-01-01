import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizQuestions } from '@/lib/db/schema';

export async function POST() {
  try {
    const questions = [
      {
        question: "What should you do if a customer asks for a refund?",
        optionA: "Give them the refund immediately",
        optionB: "Check company policy and process appropriately",
        optionC: "Ignore the request",
        optionD: "Ask them to come back tomorrow",
        correctAnswer: "B"
      },
      {
        question: "How should you handle customer complaints?",
        optionA: "Argue with the customer",
        optionB: "Listen actively and try to resolve the issue",
        optionC: "Tell them it's not your problem",
        optionD: "Hang up immediately",
        correctAnswer: "B"
      },
      {
        question: "What is the most important thing when dealing with customers?",
        optionA: "Making sales quickly",
        optionB: "Building trust and good relationships",
        optionC: "Following scripts exactly",
        optionD: "Ending calls as fast as possible",
        correctAnswer: "B"
      },
      {
        question: "When should you clock in for work?",
        optionA: "When you arrive at your desk",
        optionB: "When you start your shift as scheduled",
        optionC: "Whenever you feel like it",
        optionD: "After your break",
        correctAnswer: "B"
      },
      {
        question: "How should you record sales transactions?",
        optionA: "Only when you remember",
        optionB: "Immediately after each transaction",
        optionC: "At the end of the week",
        optionD: "Never, it's automatic",
        correctAnswer: "B"
      }
    ];

    const results = [];
    for (const question of questions) {
      const result = await db.insert(quizQuestions).values(question).returning();
      results.push(result[0]);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} quiz questions`,
      questions: results
    });
  } catch (error) {
    console.error('Error seeding quiz questions:', error);
    return NextResponse.json(
      { error: 'Failed to seed quiz questions', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to seed quiz questions',
    usage: 'curl -X POST http://localhost:3000/api/seed'
  });
}
