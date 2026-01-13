# VAPI Tool Definitions

This directory contains tool definitions for VAPI assistants.

## check_1583_status

Looks up a customer's USPS 1583 approval status in Freshsales CRM using their phone number.

### How It Works

1. **Automatic Caller Phone Lookup**: When called without arguments, the tool automatically uses the caller's phone number from the VAPI call context
2. **Phone Number Normalization**: Handles all phone formats:
   - `+19092601366` (E.164 with plus)
   - `19092601366` (with country code, no plus)
   - `9092601366` (10-digit US number - assumes +1)
   - `(909) 260-1366` (formatted)
3. **Multiple Field Search**: Tries both `mobile_number` and `phone` fields in Freshsales
4. **Fallback to User Input**: If caller's number doesn't match, returns `needsPhoneNumber: true` so the assistant knows to ask

### Setup Instructions

#### 1. Add Environment Variable

Add your Freshsales API token to `.env.local`:

```
FRESHSALES_API_TOKEN=your_token_here
```

Get your token from: Freshsales → Settings → API Settings

#### 2. Deploy Your Server

Deploy this Next.js app to get a public URL (e.g., `https://your-app.vercel.app`)

#### 3. Create Tool in VAPI Dashboard

1. Go to [VAPI Dashboard](https://dashboard.vapi.ai) → Tools
2. Create a new "Function" tool
3. Use the configuration from `check-1583-status.json`
4. Replace `{{YOUR_SERVER_URL}}` with your actual deployed URL

#### 4. Add to Your Assistant

Add the tool to your VAPI assistant and include this in your system prompt:

```
## Checking 1583 Status

When a user asks about their 1583 status, form status, or account approval:

1. Call the `check_1583_status` tool WITHOUT any arguments first - it will automatically try their caller phone number
2. If the result shows `needsPhoneNumber: true`, ask the customer for their phone number
3. Call the tool again WITH the `phone_number` argument they provide

Based on the `approvalStatus` returned, respond:
- "No Docs" → "It looks like you haven't started your 1583 form yet. Would you like help getting started?"
- "Notary" → "Your 1583 form has been submitted and is awaiting notarization."
- "Pending" → "Your 1583 form is currently pending review."
- "Approved" → "Great news! Your 1583 form has been approved."
- Other/Error → "I'm having trouble finding your status. Let me transfer you to a team member."
```

### Response Format

The tool returns:

```json
{
  "success": true,
  "contact": {
    "displayName": "John Doe",
    "mailboxId": "12345",
    "approvalStatus": "Approved",
    "flaggedForResubmission": "No",
    "belongsTo": "...",
    "tags": ["tag1", "tag2"]
  },
  "phoneSearched": "19092601366",
  "variationsTried": ["19092601366", "9092601366", "+19092601366"]
}
```

Or on failure:

```json
{
  "success": false,
  "error": "No contact found with the provided phone number",
  "needsPhoneNumber": true
}
```
