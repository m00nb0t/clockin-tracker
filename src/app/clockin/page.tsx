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

interface Creator {
  id: number;
  name: string;
  platform: 'fanvue' | 'other';
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

  // Creator selection state
  const [showCreatorSelection, setShowCreatorSelection] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<number[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(false);

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

  const fetchCreators = async () => {
    setLoadingCreators(true);
    try {
      const response = await fetch('/api/creators');
      if (response.ok) {
        const data = await response.json();
        setCreators(data.creators);
      }
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setLoadingCreators(false);
    }
  };

  const handleCreatorToggle = (creatorId: number) => {
    setSelectedCreators(prev =>
      prev.includes(creatorId)
        ? prev.filter(id => id !== creatorId)
        : [...prev, creatorId]
    );
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    setShowResult(true);
    setIsCorrect(answer === question?.correctAnswer);
  };

  const handleQuizSuccess = async () => {
    // Record quiz attempt first
    try {
      const attemptResponse = await fetch('/api/quiz/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          questionId: question!.id,
          selectedAnswer,
          correct: isCorrect,
          attemptNumber: 1,
        }),
      });

      // Now show creator selection
      await fetchCreators();
      setShowCreatorSelection(true);
    } catch (error) {
      console.error('Quiz attempt error:', error);
      alert('Error recording quiz attempt. Please try again.');
    }
  };

  const handleFinalClockIn = async () => {
    if (!userId) return;

    setClockingIn(true);
    try {
      const clockinResponse = await fetch('/api/clockin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-auth': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({
          creatorIds: selectedCreators
        }),
      });

      if (clockinResponse.ok) {
        // Send success message back to Telegram
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.sendData(JSON.stringify({
            action: 'clockin_success',
            message: `Successfully clocked in for ${selectedCreators.length} creator(s)!`
          }));
        }
        // Close the mini app
        window.Telegram?.WebApp?.close();
      } else {
        const error = await clockinResponse.json();
        alert(error.error || 'Failed to clock in. Please try again.');
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
                onClick={async () => {
                  await fetchCreators();
                  setShowCreatorSelection(true);
                }}
                disabled={clockingIn}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {clockingIn ? 'Loading...' : 'Continue to Clock In'}
              </button>
            </div>
          ) : showCreatorSelection ? (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-6 text-center">
                Select Creators You're Working On
              </h2>

              {loadingCreators ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading creators...</p>
                </div>
              ) : creators.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No active creators available.</p>
                  <button
                    onClick={handleFinalClockIn}
                    disabled={clockingIn}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {clockingIn ? 'Clocking In...' : 'Clock In (No Creators)'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Select all creators you'll be working on today. This determines tip assignment.
                  </p>

                  <div className="space-y-3 mb-6">
                    {creators.map((creator) => (
                      <label key={creator.id} className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCreators.includes(creator.id)}
                          onChange={() => handleCreatorToggle(creator.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{creator.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{creator.platform}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowCreatorSelection(false)}
                      className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleFinalClockIn}
                      disabled={clockingIn || selectedCreators.length === 0}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {clockingIn ? 'Clocking In...' : `Clock In (${selectedCreators.length})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : showResult ? (
            <div className="text-center">
              {isCorrect ? (
                <>
                  <div className="text-green-600 text-2xl mb-4">✓</div>
                  <p className="text-green-700 font-medium mb-4">Correct answer!</p>

                  {question?.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                      <h3 className="text-blue-800 font-medium mb-2">Explanation</h3>
                      <p className="text-blue-700 text-sm">{question.explanation}</p>
                    </div>
                  )}

                  <button
                    onClick={handleQuizSuccess}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Continue to Creator Selection
                  </button>
                </>
              ) : (
                <>
                  <div className="text-red-600 text-2xl mb-4">✗</div>
                  <p className="text-red-700 font-medium mb-4">Incorrect!</p>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                    <p className="text-red-800 font-semibold mb-2">
                      The correct answer was: {question.correctAnswer}
                    </p>
                    <p className="text-red-700 text-sm italic mb-3">
                      {question.correctAnswer === 'A' ? question.optionA : 
                       question.correctAnswer === 'B' ? question.optionB : 
                       question.correctAnswer === 'C' ? question.optionC : 
                       question.optionD}
                    </p>
                    
                    {question?.explanation && (
                      <>
                        <div className="h-px bg-red-200 my-3"></div>
                        <h3 className="text-red-800 font-medium mb-1 text-sm">Explanation:</h3>
                        <p className="text-red-700 text-sm">{question.explanation}</p>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleQuizSuccess}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700"
                  >
                    I Understand, Continue
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
