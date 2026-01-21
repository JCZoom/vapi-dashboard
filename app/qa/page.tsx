'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface QAResult {
  id: string;
  question: string;
  answer: string;
  rating: 'pass' | 'fail' | null;
  comment: string;
  timestamp: string;
  chatId?: string;
  toolErrors?: string[];
}

interface TestRun {
  id: string;
  name: string;
  timestamp: string;
  results: QAResult[];
  assistantId: string;
}

export default function QAPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsInput, setQuestionsInput] = useState('');
  const [assistantId, setAssistantId] = useState('756e9d05-80e3-4922-99a5-928277d93206');
  const [isRunning, setIsRunning] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [results, setResults] = useState<QAResult[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [activeTab, setActiveTab] = useState<'setup' | 'results' | 'history'>('setup');
  const [runName, setRunName] = useState('');

  useEffect(() => {
    const authenticated = sessionStorage.getItem('vapi_dashboard_auth') === 'true';
    setIsAuthenticated(authenticated);
    setIsLoading(false);
    
    // Load saved test runs from localStorage
    const savedRuns = localStorage.getItem('qa_test_runs');
    if (savedRuns) {
      setTestRuns(JSON.parse(savedRuns));
    }
  }, []);

  const parseQuestions = (input: string): string[] => {
    // Handle CSV or line-separated input
    const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    return lines.map(line => {
      // Remove CSV formatting if present
      if (line.startsWith('"') && line.endsWith('"')) {
        return line.slice(1, -1);
      }
      return line;
    });
  };

  const handleQuestionsChange = (value: string) => {
    setQuestionsInput(value);
    setQuestions(parseQuestions(value));
  };

  const runTest = async (question: string): Promise<QAResult> => {
    try {
      const response = await fetch('/api/qa/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, assistantId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          id: crypto.randomUUID(),
          question,
          answer: `Error: ${data.error}`,
          rating: null,
          comment: '',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        id: crypto.randomUUID(),
        question: data.question,
        answer: data.answer,
        rating: null,
        comment: '',
        timestamp: data.timestamp,
        chatId: data.chatId,
        toolErrors: data.toolErrors,
      };
    } catch (error) {
      return {
        id: crypto.randomUUID(),
        question,
        answer: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rating: null,
        comment: '',
        timestamp: new Date().toISOString(),
      };
    }
  };

  const runAllTests = async () => {
    if (questions.length === 0) return;

    setIsRunning(true);
    setCurrentProgress(0);
    setResults([]);
    setActiveTab('results');

    const newResults: QAResult[] = [];

    for (let i = 0; i < questions.length; i++) {
      const result = await runTest(questions[i]);
      newResults.push(result);
      setResults([...newResults]);
      setCurrentProgress(((i + 1) / questions.length) * 100);
      
      // Small delay to avoid rate limiting
      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);
  };

  const updateRating = (id: string, rating: 'pass' | 'fail') => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, rating } : r));
  };

  const updateComment = (id: string, comment: string) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, comment } : r));
  };

  const saveTestRun = () => {
    const name = runName || `Test Run ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    const newRun: TestRun = {
      id: crypto.randomUUID(),
      name,
      timestamp: new Date().toISOString(),
      results: results,
      assistantId,
    };

    const updatedRuns = [newRun, ...testRuns];
    setTestRuns(updatedRuns);
    localStorage.setItem('qa_test_runs', JSON.stringify(updatedRuns));
    setRunName('');
    alert('Test run saved!');
  };

  const loadTestRun = (run: TestRun) => {
    setResults(run.results);
    setAssistantId(run.assistantId);
    setActiveTab('results');
  };

  const deleteTestRun = (id: string) => {
    const updatedRuns = testRuns.filter(r => r.id !== id);
    setTestRuns(updatedRuns);
    localStorage.setItem('qa_test_runs', JSON.stringify(updatedRuns));
  };

  const getStats = (resultSet: QAResult[]) => {
    const total = resultSet.length;
    const passed = resultSet.filter(r => r.rating === 'pass').length;
    const failed = resultSet.filter(r => r.rating === 'fail').length;
    const unrated = resultSet.filter(r => r.rating === null).length;
    const passRate = total > 0 ? ((passed / (passed + failed)) * 100) || 0 : 0;
    return { total, passed, failed, unrated, passRate };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-4">Access Required</h1>
          <p className="text-gray-400 mb-4">Please authenticate through the main dashboard first.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const stats = getStats(results);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold">QA Evaluation Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('setup')}
              className={`px-4 py-2 rounded ${activeTab === 'setup' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Setup
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded ${activeTab === 'results' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Results {results.length > 0 && `(${results.length})`}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded ${activeTab === 'history' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              History {testRuns.length > 0 && `(${testRuns.length})`}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Setup Tab */}
        {activeTab === 'setup' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Test Configuration</h2>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Assistant ID</label>
                <input
                  type="text"
                  value={assistantId}
                  onChange={(e) => setAssistantId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="Enter assistant ID"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Questions (one per line, or CSV format)
                </label>
                <textarea
                  value={questionsInput}
                  onChange={(e) => handleQuestionsChange(e.target.value)}
                  className="w-full h-64 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm"
                  placeholder="Enter questions here, one per line:&#10;&#10;What is a virtual mailbox?&#10;How do I sign up for iPostal1?&#10;What are the pricing plans?"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">
                  {questions.length} question{questions.length !== 1 ? 's' : ''} loaded
                </span>
                <button
                  onClick={runAllTests}
                  disabled={questions.length === 0 || isRunning}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? 'Running...' : 'Run All Tests'}
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            {testRuns.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Test Runs</h2>
                <div className="space-y-2">
                  {testRuns.slice(0, 3).map(run => {
                    const runStats = getStats(run.results);
                    return (
                      <div
                        key={run.id}
                        onClick={() => loadTestRun(run)}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
                      >
                        <div>
                          <span className="font-medium">{run.name}</span>
                          <span className="text-gray-400 text-sm ml-2">
                            {new Date(run.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-green-400">{runStats.passed} ✓</span>
                          <span className="text-red-400">{runStats.failed} ✗</span>
                          <span className="text-gray-400">{runStats.unrated} ?</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {/* Progress Bar */}
            {isRunning && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span>Running tests...</span>
                  <span>{Math.round(currentProgress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${currentProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats Summary */}
            {results.length > 0 && (
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold">{stats.total}</div>
                  <div className="text-gray-400 text-sm">Total</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{stats.passed}</div>
                  <div className="text-gray-400 text-sm">Passed</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
                  <div className="text-gray-400 text-sm">Failed</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-400">{stats.unrated}</div>
                  <div className="text-gray-400 text-sm">Unrated</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {stats.passed + stats.failed > 0 ? stats.passRate.toFixed(0) : '-'}%
                  </div>
                  <div className="text-gray-400 text-sm">Pass Rate</div>
                </div>
              </div>
            )}

            {/* Save Run */}
            {results.length > 0 && !isRunning && (
              <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-4">
                <input
                  type="text"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  placeholder="Test run name (optional)"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
                <button
                  onClick={saveTestRun}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Save Test Run
                </button>
              </div>
            )}

            {/* Results List */}
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  className={`bg-gray-800 rounded-lg p-4 border-l-4 ${
                    result.rating === 'pass'
                      ? 'border-green-500'
                      : result.rating === 'fail'
                      ? 'border-red-500'
                      : 'border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400 text-sm">#{index + 1}</span>
                        <span className="font-medium text-blue-400">Q:</span>
                        <span>{result.question}</span>
                      </div>
                      <div className="bg-gray-700 rounded p-3 mt-2">
                        <span className="font-medium text-green-400">A:</span>
                        <p className="mt-1 text-gray-300 whitespace-pre-wrap">{result.answer}</p>
                      </div>
                      {result.toolErrors && result.toolErrors.length > 0 && (
                        <div className="bg-yellow-900/30 border border-yellow-600/50 rounded p-2 mt-2 text-xs">
                          <span className="text-yellow-400">⚠ Tool errors:</span>
                          <span className="text-yellow-200 ml-1">{result.toolErrors.length} error(s)</span>
                        </div>
                      )}
                      <div className="mt-3">
                        <textarea
                          value={result.comment}
                          onChange={(e) => updateComment(result.id, e.target.value)}
                          placeholder="Add notes about this response (what's right/wrong, needed adjustments...)"
                          className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => updateRating(result.id, 'pass')}
                        className={`p-2 rounded ${
                          result.rating === 'pass'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-green-600 hover:text-white'
                        }`}
                        title="Pass"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => updateRating(result.id, 'fail')}
                        className={`p-2 rounded ${
                          result.rating === 'fail'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-red-600 hover:text-white'
                        }`}
                        title="Fail"
                      >
                        👎
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {results.length === 0 && !isRunning && (
              <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-400">
                <p>No test results yet.</p>
                <p className="text-sm mt-2">Go to Setup tab to add questions and run tests.</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Test Run History</h2>
            
            {testRuns.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-400">
                <p>No saved test runs yet.</p>
                <p className="text-sm mt-2">Run tests and save them to track your QA progress over time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {testRuns.map(run => {
                  const runStats = getStats(run.results);
                  return (
                    <div key={run.id} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{run.name}</h3>
                          <p className="text-gray-400 text-sm">
                            {new Date(run.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadTestRun(run)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            View
                          </button>
                          <button
                            onClick={() => deleteTestRun(run.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      {/* Mini stats */}
                      <div className="grid grid-cols-5 gap-2 text-sm">
                        <div className="bg-gray-700 rounded p-2 text-center">
                          <div className="font-bold">{runStats.total}</div>
                          <div className="text-gray-400 text-xs">Total</div>
                        </div>
                        <div className="bg-gray-700 rounded p-2 text-center">
                          <div className="font-bold text-green-400">{runStats.passed}</div>
                          <div className="text-gray-400 text-xs">Passed</div>
                        </div>
                        <div className="bg-gray-700 rounded p-2 text-center">
                          <div className="font-bold text-red-400">{runStats.failed}</div>
                          <div className="text-gray-400 text-xs">Failed</div>
                        </div>
                        <div className="bg-gray-700 rounded p-2 text-center">
                          <div className="font-bold text-gray-400">{runStats.unrated}</div>
                          <div className="text-gray-400 text-xs">Unrated</div>
                        </div>
                        <div className="bg-gray-700 rounded p-2 text-center">
                          <div className="font-bold text-blue-400">
                            {runStats.passed + runStats.failed > 0 ? runStats.passRate.toFixed(0) : '-'}%
                          </div>
                          <div className="text-gray-400 text-xs">Pass Rate</div>
                        </div>
                      </div>

                      {/* Pass rate bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${runStats.passRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
