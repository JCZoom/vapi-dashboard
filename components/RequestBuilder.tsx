'use client';

import { HttpMethod } from '@/lib/types';

interface RequestBuilderProps {
  method: HttpMethod;
  setMethod: (method: HttpMethod) => void;
  path: string;
  setPath: (path: string) => void;
  headers: string;
  setHeaders: (headers: string) => void;
  body: string;
  setBody: (body: string) => void;
  isCustom: boolean;
}

const methods: HttpMethod[] = ['GET', 'POST', 'PATCH', 'DELETE'];

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-green-600',
  POST: 'bg-blue-600',
  PATCH: 'bg-yellow-600',
  DELETE: 'bg-red-600',
};

export default function RequestBuilder({
  method,
  setMethod,
  path,
  setPath,
  headers,
  setHeaders,
  body,
  setBody,
  isCustom,
}: RequestBuilderProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-4">
      <h3 className="text-sm font-medium text-gray-400">Request Builder</h3>

      {/* Method & Path */}
      <div className="flex gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          disabled={!isCustom}
          className={`px-3 py-2 ${methodColors[method]} rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70`}
        >
          {methods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          disabled={!isCustom}
          placeholder="/endpoint"
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:opacity-70"
        />
      </div>

      {/* Headers */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Custom Headers (JSON)
        </label>
        <textarea
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          rows={2}
          placeholder='{"X-Custom-Header": "value"}'
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
        />
      </div>

      {/* Body */}
      {(method === 'POST' || method === 'PATCH' || isCustom) && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Request Body (JSON)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="{}"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y"
          />
        </div>
      )}
    </div>
  );
}
