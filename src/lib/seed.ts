import { db } from './db';
import { quizQuestions } from './db/schema';

export async function seedQuizQuestions() {
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

  try {
    for (const question of questions) {
      await db.insert(quizQuestions).values(question);
    }
    console.log('Seeded quiz questions successfully');
  } catch (error) {
    console.error('Error seeding quiz questions:', error);
  }
}
