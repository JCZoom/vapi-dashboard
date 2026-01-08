'use client';

import { useState, useEffect, useCallback } from 'react';
import { ApiTemplate, ApiResponse, Assistant, Call, HttpMethod } from '@/lib/types';
import { apiTemplates, templateCategories, getTemplatesByCategory } from '@/lib/templates';
import RequestBuilder from './RequestBuilder';
import ResponseViewer from './ResponseViewer';

export default function Dashboard() {
  const [selectedTemplate, setSelectedTemplate] = useState<ApiTemplate>(apiTemplates[0]);
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState('/call');
  const [headers, setHeaders] = useState<string>('{}');
  const [body, setBody] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [recentCalls, setRecentCalls] = useState<Call[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const fetchAssistants = useCallback(async () => {
    setLoadingAssistants(true);
    try {
      const res = await fetch('/api/vapi/assistants');
      if (res.ok) {
        const data = await res.json();
        setAssistants(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch assistants:', err);
    } finally {
      setLoadingAssistants(false);
    }
  }, []);

  const fetchRecentCalls = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const res = await fetch('/api/vapi/calls?limit=10');
      if (res.ok) {
        const data = await res.json();
        setRecentCalls(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoadingCalls(false);
    }
  }, []);

  useEffect(() => {
    fetchAssistants();
    fetchRecentCalls();
  }, [fetchAssistants, fetchRecentCalls]);

  const handleTemplateChange = (templateId: string) => {
    const template = apiTemplates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setMethod(template.method);
      setPath(template.path);
      setFieldValues({});
      setBody(template.bodyTemplate ? JSON.stringify(template.bodyTemplate, null, 2) : '');
      setResponse(null);
      setError(null);
      setValidationErrors([]);
    }
  };

  const updatePathWithFields = useCallback((basePath: string, fields: Record<string, string>) => {
    let updatedPath = basePath;
    Object.entries(fields).forEach(([key, value]) => {
      updatedPath = updatedPath.replace(`{${key}}`, value || `{${key}}`);
    });
    return updatedPath;
  }, []);

  const handleFieldChange = (fieldName: string, value: string) => {
    const newFields = { ...fieldValues, [fieldName]: value };
    setFieldValues(newFields);

    const pathField = selectedTemplate.requiredFields.find(
      (f) => f.name === fieldName && f.type === 'path'
    );
    if (pathField) {
      setPath(updatePathWithFields(selectedTemplate.path, newFields));
    }

    const bodyField = selectedTemplate.requiredFields.find(
      (f) => f.name === fieldName && f.type === 'body'
    );
    if (bodyField && body) {
      try {
        const bodyObj = JSON.parse(body);
        const keys = fieldName.split('.');
        let current = bodyObj;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {};
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        setBody(JSON.stringify(bodyObj, null, 2));
      } catch {
        // Invalid JSON, skip
      }
    }
  };

  const validateRequest = (): boolean => {
    const errors: string[] = [];
    selectedTemplate.requiredFields.forEach((field) => {
      if (!fieldValues[field.name]?.trim()) {
        errors.push(`${field.label} is required`);
      }
    });
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const generateCurl = (): string => {
    const baseUrl = 'https://api.vapi.ai';
    const fullPath = updatePathWithFields(path, fieldValues);
    let curl = `curl -X ${method} '${baseUrl}${fullPath}'`;
    curl += ` \\\n  -H 'Authorization: Bearer $VAPI_API_KEY'`;
    curl += ` \\\n  -H 'Content-Type: application/json'`;

    try {
      const customHeaders = JSON.parse(headers);
      Object.entries(customHeaders).forEach(([key, value]) => {
        curl += ` \\\n  -H '${key}: ${value}'`;
      });
    } catch {
      // Invalid headers JSON
    }

    if (body && ['POST', 'PATCH', 'PUT'].includes(method)) {
      try {
        const bodyObj = JSON.parse(body);
        curl += ` \\\n  -d '${JSON.stringify(bodyObj)}'`;
      } catch {
        curl += ` \\\n  -d '${body}'`;
      }
    }

    return curl;
  };

  const handleSendRequest = async () => {
    if (!validateRequest()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const finalPath = updatePathWithFields(path, fieldValues);
      let customHeaders = {};
      try {
        customHeaders = JSON.parse(headers);
      } catch {
        // Invalid headers
      }

      let bodyData = undefined;
      if (body && ['POST', 'PATCH', 'PUT'].includes(method)) {
        try {
          bodyData = JSON.parse(body);
        } catch {
          setError('Invalid JSON in request body');
          setIsLoading(false);
          return;
        }
      }

      const res = await fetch('/api/vapi/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: finalPath,
          method,
          headers: customHeaders,
          body: bodyData,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResponse({
          status: data.status,
          statusText: data.statusText,
          headers: data.headers,
          data: data.data,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Vapi API Explorer</h1>
          <button
            onClick={() => {
              sessionStorage.removeItem('vapi_dashboard_auth');
              window.location.reload();
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Request Builder */}
          <div className="space-y-6">
            {/* Template Selector */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Endpoint Template
              </label>
              <select
                value={selectedTemplate.id}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {templateCategories.map((category) => (
                  <optgroup key={category} label={category}>
                    {getTemplatesByCategory(category).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.method} - {template.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500">{selectedTemplate.description}</p>
            </div>

            {/* Required Fields */}
            {selectedTemplate.requiredFields.length > 0 && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Required Inputs</h3>
                <div className="space-y-3">
                  {selectedTemplate.requiredFields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-gray-300 mb-1">
                        {field.label}
                        {field.description && (
                          <span className="text-gray-500 ml-2 text-xs">
                            ({field.description})
                          </span>
                        )}
                      </label>

                      {field.name === 'assistantId' || field.name === 'assistant_id' ? (
                        <div className="flex gap-2">
                          <select
                            value={fieldValues[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select assistant...</option>
                            {assistants.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name || a.id}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={fetchAssistants}
                            disabled={loadingAssistants}
                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
                          >
                            {loadingAssistants ? '...' : '↻'}
                          </button>
                        </div>
                      ) : field.name === 'call_id' ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <select
                              value=""
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Recent calls...</option>
                              {recentCalls.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.id.slice(0, 8)}... - {c.status} - {new Date(c.createdAt).toLocaleString()}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={fetchRecentCalls}
                              disabled={loadingCalls}
                              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                              {loadingCalls ? '...' : '↻'}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={fieldValues[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={fieldValues[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {validationErrors.length > 0 && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                    {validationErrors.map((err, i) => (
                      <p key={i} className="text-red-400 text-sm">
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Request Builder */}
            <RequestBuilder
              method={method}
              setMethod={setMethod}
              path={path}
              setPath={setPath}
              headers={headers}
              setHeaders={setHeaders}
              body={body}
              setBody={setBody}
              isCustom={selectedTemplate.id === 'custom'}
            />

            {/* cURL Preview */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-400">cURL Preview</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(generateCurl())}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Copy
                </button>
              </div>
              <pre className="text-xs text-green-400 bg-gray-950 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                {generateCurl()}
              </pre>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendRequest}
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Sending...
                </>
              ) : (
                'Send Request'
              )}
            </button>
          </div>

          {/* Right Panel - Response Viewer */}
          <div>
            <ResponseViewer response={response} error={error} isLoading={isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}
