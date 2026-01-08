'use client';

import { useState, useMemo } from 'react';
import { ApiResponse } from '@/lib/types';

interface ResponseViewerProps {
  response: ApiResponse | null;
  error: string | null;
  isLoading: boolean;
}

interface FieldNode {
  path: string;
  label: string;
  hasChildren: boolean;
  isArray: boolean;
}

function getAllPaths(obj: unknown, prefix = ''): FieldNode[] {
  const paths: FieldNode[] = [];

  if (obj === null || obj === undefined) return paths;

  if (Array.isArray(obj)) {
    paths.push({
      path: prefix || 'root',
      label: prefix || 'root',
      hasChildren: obj.length > 0,
      isArray: true,
    });
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      const childPaths = getAllPaths(obj[0], `${prefix}[]`);
      paths.push(...childPaths);
    }
  } else if (typeof obj === 'object') {
    Object.keys(obj as Record<string, unknown>).forEach((key) => {
      const newPath = prefix ? `${prefix}.${key}` : key;
      const value = (obj as Record<string, unknown>)[key];
      const isArray = Array.isArray(value);
      const hasChildren =
        value !== null &&
        typeof value === 'object' &&
        (isArray ? (value as unknown[]).length > 0 : Object.keys(value as object).length > 0);

      paths.push({
        path: newPath,
        label: key,
        hasChildren,
        isArray,
      });

      if (hasChildren) {
        paths.push(...getAllPaths(value, newPath));
      }
    });
  }

  return paths;
}

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path || path === 'root') return obj;

  const parts = path.split(/\.|\[\]/g).filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      current = current.map((item) => {
        if (item && typeof item === 'object' && part in item) {
          return (item as Record<string, unknown>)[part];
        }
        return undefined;
      });
    } else if (typeof current === 'object' && part in (current as object)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function filterObjectByPaths(
  obj: unknown,
  selectedPaths: Set<string>
): unknown {
  if (selectedPaths.size === 0) return obj;

  const result: Record<string, unknown> = {};

  selectedPaths.forEach((path) => {
    const value = getValueAtPath(obj, path);
    if (value !== undefined) {
      result[path] = value;
    }
  });

  return result;
}

export default function ResponseViewer({
  response,
  error,
  isLoading,
}: ResponseViewerProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [fieldSearch, setFieldSearch] = useState('');

  const availableFields = useMemo(() => {
    if (!response?.data) return [];
    return getAllPaths(response.data);
  }, [response?.data]);

  const filteredFields = useMemo(() => {
    if (!fieldSearch) return availableFields;
    return availableFields.filter((f) =>
      f.path.toLowerCase().includes(fieldSearch.toLowerCase())
    );
  }, [availableFields, fieldSearch]);

  const displayedData = useMemo(() => {
    if (!response?.data || selectedFields.size === 0) return response?.data;
    return filterObjectByPaths(response.data, selectedFields);
  }, [response?.data, selectedFields]);

  const transcripts = useMemo(() => {
    if (!response?.data) return [];

    const data = response.data;
    const results: Array<{
      callId: string;
      assistantId?: string;
      transcript: string;
      createdAt?: string;
      endedAt?: string;
    }> = [];

    if (Array.isArray(data)) {
      data.forEach((call) => {
        if (call && typeof call === 'object') {
          const c = call as Record<string, unknown>;
          if (c.transcript || c.messages) {
            let transcript = '';
            if (typeof c.transcript === 'string') {
              transcript = c.transcript;
            } else if (Array.isArray(c.messages)) {
              transcript = (c.messages as Array<{ role?: string; content?: string }>)
                .filter((m) => m.role && m.content)
                .map((m) => `${m.role}: ${m.content}`)
                .join('\n');
            }
            if (transcript) {
              results.push({
                callId: String(c.id || ''),
                assistantId: c.assistantId as string | undefined,
                transcript,
                createdAt: c.createdAt as string | undefined,
                endedAt: c.endedAt as string | undefined,
              });
            }
          }
        }
      });
    } else if (data && typeof data === 'object') {
      const c = data as Record<string, unknown>;
      if (c.transcript || c.messages) {
        let transcript = '';
        if (typeof c.transcript === 'string') {
          transcript = c.transcript;
        } else if (Array.isArray(c.messages)) {
          transcript = (c.messages as Array<{ role?: string; content?: string }>)
            .filter((m) => m.role && m.content)
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');
        }
        if (transcript) {
          results.push({
            callId: String(c.id || ''),
            assistantId: c.assistantId as string | undefined,
            transcript,
            createdAt: c.createdAt as string | undefined,
            endedAt: c.endedAt as string | undefined,
          });
        }
      }
    }

    return results;
  }, [response?.data]);

  const toggleField = (path: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFields(newSelected);
  };

  const statusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-400';
    if (status >= 400 && status < 500) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Sending request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg border border-red-800 p-6">
        <h3 className="text-red-400 font-medium mb-2">Error</h3>
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 h-full flex items-center justify-center">
        <p className="text-gray-500">Send a request to see the response</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        {/* Response Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`font-mono font-bold ${statusColor(response.status)}`}>
              {response.status}
            </span>
            <span className="text-gray-400 text-sm">{response.statusText}</span>
          </div>
          <div className="flex items-center gap-2">
            {transcripts.length > 0 && (
              <button
                onClick={() => setShowTranscript(true)}
                className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded transition-colors"
              >
                View Transcripts ({transcripts.length})
              </button>
            )}
            <button
              onClick={() => setShowFieldPicker(!showFieldPicker)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showFieldPicker
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Field Picker {selectedFields.size > 0 && `(${selectedFields.size})`}
            </button>
            <button
              onClick={() => setShowFullscreen(true)}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Expand
            </button>
          </div>
        </div>

        {/* Field Picker */}
        {showFieldPicker && (
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-850">
            <input
              type="text"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="Search fields..."
              className="w-full px-3 py-2 mb-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredFields.map((field) => (
                <label
                  key={field.path}
                  className="flex items-center gap-2 text-sm text-gray-300 hover:bg-gray-800 p-1 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(field.path)}
                    onChange={() => toggleField(field.path)}
                    className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="font-mono text-xs">
                    {field.path}
                    {field.isArray && <span className="text-blue-400">[]</span>}
                  </span>
                </label>
              ))}
            </div>
            {selectedFields.size > 0 && (
              <button
                onClick={() => setSelectedFields(new Set())}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
              >
                Clear selection
              </button>
            )}
          </div>
        )}

        {/* Response Body */}
        <div className="p-4 max-h-[600px] overflow-auto">
          <pre className="text-sm text-gray-300 font-mono whitespace-pre overflow-x-auto">
            {JSON.stringify(displayedData, null, 2)}
          </pre>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`font-mono font-bold ${statusColor(response.status)}`}>
                  {response.status}
                </span>
                <span className="text-gray-400">{response.statusText}</span>
              </div>
              <button
                onClick={() => setShowFullscreen(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre">
                {JSON.stringify(displayedData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {showTranscript && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Transcripts ({transcripts.length})
              </h2>
              <button
                onClick={() => setShowTranscript(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {transcripts.map((t, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-3">
                    <span>
                      <strong className="text-gray-300">Call ID:</strong> {t.callId}
                    </span>
                    {t.assistantId && (
                      <span>
                        <strong className="text-gray-300">Assistant:</strong>{' '}
                        {t.assistantId}
                      </span>
                    )}
                    {t.createdAt && (
                      <span>
                        <strong className="text-gray-300">Created:</strong>{' '}
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    )}
                    {t.endedAt && (
                      <span>
                        <strong className="text-gray-300">Ended:</strong>{' '}
                        {new Date(t.endedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-900 rounded p-3 text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
                    {t.transcript}
                  </div>
                </div>
              ))}
              {transcripts.length === 0 && (
                <p className="text-gray-500 text-center">No transcripts found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
