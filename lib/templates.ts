import { ApiTemplate } from './types';

export const apiTemplates: ApiTemplate[] = [
  // Calls
  {
    id: 'list-calls',
    name: 'List Calls',
    category: 'Calls',
    method: 'GET',
    path: '/call',
    description: 'Retrieve a list of all calls',
    requiredFields: [],
  },
  {
    id: 'get-call',
    name: 'Get Call',
    category: 'Calls',
    method: 'GET',
    path: '/call/{call_id}',
    description: 'Retrieve details of a specific call by ID',
    requiredFields: [
      {
        name: 'call_id',
        label: 'Call ID',
        type: 'path',
        placeholder: 'Enter call ID',
        description: 'The unique identifier of the call',
      },
    ],
  },
  {
    id: 'create-call',
    name: 'Create Call (Outbound)',
    category: 'Calls',
    method: 'POST',
    path: '/call',
    description: 'Create a new outbound phone call',
    requiredFields: [
      {
        name: 'assistantId',
        label: 'Assistant ID',
        type: 'body',
        placeholder: 'Select or enter assistant ID',
        description: 'The assistant to use for the call',
      },
      {
        name: 'phoneNumberId',
        label: 'Phone Number ID',
        type: 'body',
        placeholder: 'Enter phone number ID',
        description: 'The Vapi phone number to call from',
      },
      {
        name: 'customer.number',
        label: 'Customer Phone Number',
        type: 'body',
        placeholder: '+1234567890',
        description: 'The customer phone number to call',
      },
    ],
    bodyTemplate: {
      assistantId: '',
      phoneNumberId: '',
      customer: {
        number: '',
      },
    },
  },
  {
    id: 'delete-call',
    name: 'Delete Call',
    category: 'Calls',
    method: 'DELETE',
    path: '/call/{call_id}',
    description: 'Delete a specific call by ID',
    requiredFields: [
      {
        name: 'call_id',
        label: 'Call ID',
        type: 'path',
        placeholder: 'Enter call ID',
      },
    ],
  },

  // Assistants
  {
    id: 'list-assistants',
    name: 'List Assistants',
    category: 'Assistants',
    method: 'GET',
    path: '/assistant',
    description: 'Retrieve a list of all assistants',
    requiredFields: [],
  },
  {
    id: 'get-assistant',
    name: 'Get Assistant',
    category: 'Assistants',
    method: 'GET',
    path: '/assistant/{assistant_id}',
    description: 'Retrieve details of a specific assistant',
    requiredFields: [
      {
        name: 'assistant_id',
        label: 'Assistant ID',
        type: 'path',
        placeholder: 'Select or enter assistant ID',
      },
    ],
  },
  {
    id: 'create-assistant',
    name: 'Create Assistant',
    category: 'Assistants',
    method: 'POST',
    path: '/assistant',
    description: 'Create a new assistant',
    requiredFields: [
      {
        name: 'name',
        label: 'Name',
        type: 'body',
        placeholder: 'My Assistant',
      },
    ],
    bodyTemplate: {
      name: '',
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
        ],
      },
      voice: {
        provider: '11labs',
        voiceId: 'rachel',
      },
    },
  },
  {
    id: 'update-assistant',
    name: 'Update Assistant',
    category: 'Assistants',
    method: 'PATCH',
    path: '/assistant/{assistant_id}',
    description: 'Update an existing assistant',
    requiredFields: [
      {
        name: 'assistant_id',
        label: 'Assistant ID',
        type: 'path',
        placeholder: 'Select or enter assistant ID',
      },
    ],
    bodyTemplate: {
      name: '',
    },
  },
  {
    id: 'delete-assistant',
    name: 'Delete Assistant',
    category: 'Assistants',
    method: 'DELETE',
    path: '/assistant/{assistant_id}',
    description: 'Delete an assistant',
    requiredFields: [
      {
        name: 'assistant_id',
        label: 'Assistant ID',
        type: 'path',
        placeholder: 'Enter assistant ID',
      },
    ],
  },

  // Phone Numbers
  {
    id: 'list-phone-numbers',
    name: 'List Phone Numbers',
    category: 'Phone Numbers',
    method: 'GET',
    path: '/phone-number',
    description: 'Retrieve a list of all phone numbers',
    requiredFields: [],
  },
  {
    id: 'get-phone-number',
    name: 'Get Phone Number',
    category: 'Phone Numbers',
    method: 'GET',
    path: '/phone-number/{phone_number_id}',
    description: 'Retrieve details of a specific phone number',
    requiredFields: [
      {
        name: 'phone_number_id',
        label: 'Phone Number ID',
        type: 'path',
        placeholder: 'Enter phone number ID',
      },
    ],
  },
  {
    id: 'update-phone-number',
    name: 'Update Phone Number',
    category: 'Phone Numbers',
    method: 'PATCH',
    path: '/phone-number/{phone_number_id}',
    description: 'Update a phone number configuration',
    requiredFields: [
      {
        name: 'phone_number_id',
        label: 'Phone Number ID',
        type: 'path',
        placeholder: 'Enter phone number ID',
      },
    ],
    bodyTemplate: {
      name: '',
    },
  },

  // Tools
  {
    id: 'list-tools',
    name: 'List Tools',
    category: 'Tools',
    method: 'GET',
    path: '/tool',
    description: 'Retrieve a list of all tools',
    requiredFields: [],
  },
  {
    id: 'get-tool',
    name: 'Get Tool',
    category: 'Tools',
    method: 'GET',
    path: '/tool/{tool_id}',
    description: 'Retrieve details of a specific tool',
    requiredFields: [
      {
        name: 'tool_id',
        label: 'Tool ID',
        type: 'path',
        placeholder: 'Enter tool ID',
      },
    ],
  },
  {
    id: 'create-tool',
    name: 'Create Tool',
    category: 'Tools',
    method: 'POST',
    path: '/tool',
    description: 'Create a new tool',
    requiredFields: [
      {
        name: 'type',
        label: 'Type',
        type: 'body',
        placeholder: 'function',
      },
    ],
    bodyTemplate: {
      type: 'function',
      function: {
        name: 'my_function',
        description: 'Description of what this function does',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      server: {
        url: 'https://your-server.com/api/tool',
      },
    },
  },
  {
    id: 'delete-tool',
    name: 'Delete Tool',
    category: 'Tools',
    method: 'DELETE',
    path: '/tool/{tool_id}',
    description: 'Delete a tool',
    requiredFields: [
      {
        name: 'tool_id',
        label: 'Tool ID',
        type: 'path',
        placeholder: 'Enter tool ID',
      },
    ],
  },

  // Analytics
  {
    id: 'list-logs',
    name: 'List Logs',
    category: 'Analytics',
    method: 'GET',
    path: '/logs',
    description: 'Retrieve logs for your organization',
    requiredFields: [],
  },
  {
    id: 'get-metrics',
    name: 'Get Metrics',
    category: 'Analytics',
    method: 'POST',
    path: '/analytics',
    description: 'Get analytics metrics for calls',
    requiredFields: [],
    bodyTemplate: {
      queries: [
        {
          name: 'call_count',
          table: 'call',
          operations: [
            {
              operation: 'count',
              column: 'id',
            },
          ],
        },
      ],
    },
  },

  // Custom
  {
    id: 'custom',
    name: 'Custom Request',
    category: 'Custom',
    method: 'GET',
    path: '/',
    description: 'Build a custom API request',
    requiredFields: [],
  },
];

export const templateCategories = [
  'Calls',
  'Assistants',
  'Phone Numbers',
  'Tools',
  'Analytics',
  'Custom',
] as const;

export function getTemplatesByCategory(category: string): ApiTemplate[] {
  return apiTemplates.filter((t) => t.category === category);
}

export function getTemplateById(id: string): ApiTemplate | undefined {
  return apiTemplates.find((t) => t.id === id);
}
