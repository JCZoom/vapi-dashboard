# Vapi API Explorer

A cURL-style API Explorer web dashboard for [Vapi](https://vapi.ai) - the voice AI platform. Quickly construct API requests, inspect responses, and view call transcripts.

## Features

- **Template-based Request Builder**: Pre-built templates for all major Vapi endpoints (Calls, Assistants, Phone Numbers, Tools, Analytics)
- **Dynamic Dropdowns**: Automatically fetch and select assistants and recent calls
- **Live cURL Preview**: See the equivalent cURL command as you build your request
- **Response Viewer**: Pretty-printed JSON with syntax highlighting
- **Field Picker**: Filter response JSON to show only selected fields (handles arrays correctly)
- **Transcript Viewer**: Extract and display call transcripts with metadata
- **Access Protection**: Simple access code gate to prevent casual public access

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Vapi API key (from [dashboard.vapi.ai](https://dashboard.vapi.ai))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vapi-dashboard.git
cd vapi-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` with your credentials:
```env
VAPI_API_KEY=your_vapi_api_key_here
DASHBOARD_ACCESS_CODE=your_access_code_here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VAPI_API_KEY` | Your Vapi API key (from dashboard.vapi.ai) |
| `DASHBOARD_ACCESS_CODE` | Password to access the dashboard |

## API Endpoints

The dashboard includes templates for:

### Calls
- List calls
- Get call by ID
- Create outbound call
- Delete call

### Assistants
- List assistants
- Get assistant by ID
- Create assistant
- Update assistant
- Delete assistant

### Phone Numbers
- List phone numbers
- Get phone number by ID
- Update phone number

### Tools
- List tools
- Get tool by ID
- Create tool
- Delete tool

### Analytics
- List logs
- Get metrics

## Deploying to Cloudflare Pages

### 1. Push repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/vapi-dashboard.git
git push -u origin main
```

### 2. Create a Cloudflare Pages project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → **Create a project**
2. Click **Connect to Git** and select the `vapi-dashboard` repository
3. Configure the build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npx @cloudflare/next-on-pages`
   - **Build output directory**: `.vercel/output/static`

### 3. Set environment variables

In your Cloudflare Pages project settings → **Environment variables**, add:

| Variable | Value |
|----------|-------|
| `VAPI_API_KEY` | Your Vapi API key |
| `DASHBOARD_ACCESS_CODE` | Your chosen access code |
| `NODE_VERSION` | `18` |

### 4. Custom domain (vapi.jeffcoy.net)

1. In your Cloudflare Pages project → **Custom domains** → **Add custom domain**
2. Enter `vapi.jeffcoy.net`
3. If `jeffcoy.net` DNS is already on Cloudflare, it will auto-add the CNAME record
4. Otherwise, manually add a CNAME record:
   - **Name**: `vapi`
   - **Target**: `<your-project>.pages.dev`

### 5. Deploy

Cloudflare will automatically deploy on every push to the `main` branch.

### Cloudflare Pages + Next.js Compatibility Notes

- **Edge Runtime**: Cloudflare Pages runs on the edge, so API routes use the Edge Runtime by default
- **`@cloudflare/next-on-pages`**: This adapter is required to build Next.js for Cloudflare Pages
- **Node.js APIs**: Some Node.js APIs may not be available in the edge runtime. This project uses only compatible APIs.
- **Environment Variables**: Must be set in Cloudflare Pages dashboard (not in `.env` files for production)

To install the Cloudflare adapter locally for testing:
```bash
npm install -D @cloudflare/next-on-pages
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Fonts**: Geist Sans & Geist Mono

## Project Structure

```
vapi-dashboard/
├── app/
│   ├── api/
│   │   ├── auth/verify/      # Access code verification
│   │   └── vapi/
│   │       ├── proxy/        # Generic Vapi API proxy
│   │       ├── assistants/   # Assistants list endpoint
│   │       └── calls/        # Calls list endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx         # Main dashboard UI
│   ├── LoginGate.tsx         # Access code gate
│   ├── RequestBuilder.tsx    # Request form
│   └── ResponseViewer.tsx    # Response display
├── lib/
│   ├── templates.ts          # API endpoint templates
│   └── types.ts              # TypeScript types
└── .env.example
```

## License

MIT
# Triggered deployment Thu Jan 22 11:51:53 EST 2026
