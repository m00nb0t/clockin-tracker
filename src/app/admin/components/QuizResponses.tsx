'use client';

import { useState, useEffect, useCallback } from 'react';

interface QuizAttempt {
  id: number;
  employeeName: string;
  questionText: string;
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
  attemptNumber: number;
  attemptedAt: string;
}

interface Stats {
  total: number;
  correct: number;
  rate: number;
}

export default function QuizResponses({ token }: { token: string }) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAttempts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/quiz/attempts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAttempts(data.attempts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching quiz attempts:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  if (loading) {
    return <div className="p-6">Loading quiz results...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
          <p className="text-sm font-medium text-gray-500 uppercase">Total Quizzes Taken</p>
          <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500 uppercase">Correct Answers</p>
          <p className="text-3xl font-bold text-gray-900">{stats?.correct || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
          <p className="text-sm font-medium text-gray-500 uppercase">Overall Accuracy</p>
          <p className="text-3xl font-bold text-gray-900">{stats?.rate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Attempts Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Quiz Answers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Answer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time (GMT+8)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{attempt.employeeName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{attempt.questionText}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="font-semibold">{attempt.selectedAnswer}</span> (Correct: {attempt.correctAnswer})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      attempt.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {attempt.correct ? 'CORRECT' : 'WRONG'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(attempt.attemptedAt).toLocaleString('en-GB', { timeZone: 'Asia/Shanghai' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

