'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Telegram WebApp type declarations
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: any;
        version: string;
        platform: string;
        colorScheme: string;
        themeParams: any;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        expand(): void;
        close(): void;
        showPopup(params: any): void;
        showAlert(message: string): void;
        showConfirm(message: string): Promise<boolean>;
        enableClosingConfirmation(): void;
        disableClosingConfirmation(): void;
        onEvent(eventType: string, eventHandler: Function): void;
        offEvent(eventType: string, eventHandler: Function): void;
        sendData(data: string): void;
        switchInlineQuery(query: string, choose_chat_types?: string[]): void;
        openLink(url: string): void;
        openTelegramLink(url: string): void;
        openInvoice(url: string): void;
        showScanQrPopup(params: any): void;
        closeScanQrPopup(): void;
        readTextFromClipboard(): Promise<string>;
        requestWriteAccess(): Promise<boolean>;
        requestContact(): Promise<any>;
        ready(): void;
        MainButton: any;
        BackButton: any;
        SettingsButton: any;
      };
    };
  }
}

interface QuizQuestion {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation?: string;
}

function ClockInContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('user');

  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchRandomQuestion();
    }
  }, [userId]);

  const fetchRandomQuestion = async () => {
    try {
      const response = await fetch('/api/quiz/random');
      if (response.ok) {
        const data = await response.json();
        setQuestion(data);
      } else {
        console.error('No quiz questions available');
        // If no questions, allow clock-in directly
        setQuestion(null);
      }
    } catch (error) {
      console.error('Error fetching question:', error);
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    setShowResult(true);
    setIsCorrect(answer === question?.correctAnswer);
  };

  const handleClockIn = async () => {
    if (!userId || !question) return;

    setClockingIn(true);
    try {
      // Record quiz attempt
      const attemptResponse = await fetch('/api/quiz/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          questionId: question.id,
          selectedAnswer,
          correct: isCorrect,
          attemptNumber: 1, // For now, simplified - could track multiple attempts
        }),
      });

      const clockinResponse = await fetch('/api/clockin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (clockinResponse.ok) {
        // Send success message back to Telegram
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.sendData(JSON.stringify({
            action: 'clockin_success',
            message: 'Successfully clocked in!'
          }));
        }
        // Close the mini app
        window.Telegram?.WebApp?.close();
      } else {
        alert('Failed to clock in. Please try again.');
      }
    } catch (error) {
      console.error('Clock-in error:', error);
      alert('Error clocking in. Please try again.');
    } finally {
      setClockingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Clock In Quiz
          </h1>

          {!question ? (
            <div className="text-center">
              <p className="text-gray-600 mb-4">No quiz questions available.</p>
              <button
                onClick={handleClockIn}
                disabled={clockingIn}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {clockingIn ? 'Clocking In...' : 'Clock In'}
              </button>
            </div>
          ) : showResult ? (
            <div className="text-center">
              {isCorrect ? (
                <>
                  <div className="text-green-600 text-2xl mb-4">✓</div>
                  <p className="text-green-700 font-medium mb-4">Correct answer!</p>

                  {question?.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                      <h3 className="text-blue-800 font-medium mb-2">Why is this the correct answer?</h3>
                      <p className="text-blue-700 text-sm">{question.explanation}</p>
                    </div>
                  )}

                  <button
                    onClick={handleClockIn}
                    disabled={clockingIn}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {clockingIn ? 'Clocking In...' : 'Confirm Clock In'}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-red-600 text-2xl mb-4">✗</div>
                  <p className="text-red-700 font-medium mb-4">Wrong! Try again.</p>
                  <p className="text-gray-600 mb-6">Please select the correct answer.</p>
                  <button
                    onClick={() => {
                      setShowResult(false);
                      setSelectedAnswer('');
                    }}
                    className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-6">
                {question.question}
              </h2>

              <div className="space-y-3">
                {[
                  { key: 'A', text: question.optionA },
                  { key: 'B', text: question.optionB },
                  { key: 'C', text: question.optionC },
                  { key: 'D', text: question.optionD },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleAnswerSelect(option.key)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-medium text-blue-600 mr-3">{option.key}.</span>
                    {option.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClockInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ClockInContent />
    </Suspense>
  );
}
