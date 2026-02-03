# Custom RAG Deployment Guide for VAPI Voice Bot

This guide covers deploying the custom FAISS-based RAG system to replace VAPI's slow Gemini knowledge base queries.

## Overview

**Problem:** VAPI's built-in Gemini query tool hits rate limits causing 6-14 second delays.

**Solution:** Custom Python Lambda with FAISS vector search, targeting <2 second response times.

```
VAPI Call → Function Tool → Lambda (FAISS Search) → Response
                              ↑
                    Uses kb_default index from freshchat-poc
                    (updated daily by Bitbucket cron)
```

## Prerequisites

1. AWS CLI configured with access to us-east-2
2. VAPI API key
3. OpenAI API key (for query embeddings)
4. freshchat-poc repository cloned with valid FAISS index

## Deployment Steps

### Step 1: Deploy the Lambda Function

```bash
cd /Users/Jeffrey.Coy/Projects/freshchat-poc

# Make the script executable
chmod +x aws/scripts/deploy-kb-search-lambda.sh

# Deploy
./aws/scripts/deploy-kb-search-lambda.sh
```

This will:
- Package Python dependencies + FAISS
- Include the current FAISS index
- Create Lambda function with Function URL
- Output the URL (save this!)

### Step 2: Configure Lambda Environment

Set the OpenAI API key in Lambda:

```bash
aws lambda update-function-configuration \
  --function-name kb-search \
  --environment 'Variables={KB_COLLECTION=kb_default,OPENAI_API_KEY=sk-xxx}' \
  --region us-east-2
```

### Step 3: Test the Lambda

```bash
# Health check
curl https://YOUR_LAMBDA_URL/health

# Search test
curl -X POST https://YOUR_LAMBDA_URL \
  -H 'Content-Type: application/json' \
  -d '{"query": "how do I forward my mail?"}'
```

Expected response time: <500ms (after warm-up)

### Step 4: Configure VAPI

```bash
cd /Users/Jeffrey.Coy/CascadeProjects/vapi-dashboard

# Install dependencies if needed
npm install

# Configure VAPI with the new tool
VAPI_API_KEY=xxx \
KB_SEARCH_URL=https://YOUR_LAMBDA_URL/ \
npx ts-node scripts/configure-vapi-kb-tool.ts
```

This will:
- Create the `search_knowledge_base` function tool in VAPI
- Update the assistant to use the new tool
- Remove the old slow Gemini query tool

### Step 5: Update Daily Cron

Add Lambda sync to the refresh-kb pipeline in `bitbucket-pipelines.yml`:

```yaml
# At the end of refresh-kb step, add:
- echo "🔄 Syncing KB index to Lambda..."
- chmod +x aws/scripts/sync-kb-index-to-lambda.sh
- ./aws/scripts/sync-kb-index-to-lambda.sh
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VAPI Platform                            │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │  Phone   │───▶│   Voice Bot     │───▶│  Function Tool   │   │
│  │  Call    │    │  (Assistant)    │    │  search_kb       │   │
│  └──────────┘    └─────────────────┘    └────────┬─────────┘   │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS Lambda (us-east-2)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  kb-search Lambda                                         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────────────┐   │   │
│  │  │  handler   │─▶│  OpenAI    │─▶│   FAISS Index     │   │   │
│  │  │  .py       │  │  Embedding │  │   (kb_default)    │   │   │
│  │  └────────────┘  └────────────┘  └───────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                                   ▲
                                                   │ Daily sync
┌─────────────────────────────────────────────────────────────────┐
│                    Bitbucket Pipelines                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  refresh-kb (Daily at 10 AM EST)                           │ │
│  │  1. Fetch Freshdesk articles                                │ │
│  │  2. Rebuild FAISS index                                     │ │
│  │  3. Commit to git                                           │ │
│  │  4. Sync to Lambda ← NEW                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Expectations

| Metric | Gemini (Before) | Lambda (After) |
|--------|-----------------|----------------|
| Cold start | N/A | ~2-3 seconds |
| Warm query | 6-14 seconds | 200-500ms |
| Rate limits | Frequent 429s | None |

Note: Lambda stays warm for ~15 minutes after each invocation.

## Troubleshooting

### Lambda cold starts too slow

Options:
1. **Provisioned Concurrency** - Keep Lambda warm ($$$)
2. **Ping cron** - Call /health every 5 minutes to keep warm
3. **Migrate to Fargate** - Always-on container

### Search returns no results

1. Check FAISS index exists in Lambda:
   ```bash
   aws lambda invoke --function-name kb-search \
     --payload '{"path":"/health"}' /tmp/out.json
   cat /tmp/out.json  # Check index_size > 0
   ```

2. Verify index was synced after last KB refresh

### VAPI tool not triggering

1. Check assistant has the tool ID in toolIds array
2. Check tool server URL is correct
3. Look at VAPI call logs for tool call attempts

## Files Reference

| File | Location | Purpose |
|------|----------|---------|
| `handler.py` | freshchat-poc/aws/lambda/kb-search/ | Lambda handler |
| `deploy-kb-search-lambda.sh` | freshchat-poc/aws/scripts/ | Deploy script |
| `sync-kb-index-to-lambda.sh` | freshchat-poc/aws/scripts/ | Daily sync |
| `search-knowledge-base.json` | vapi-dashboard/lib/vapi-tool-definitions/ | Tool definition |
| `configure-vapi-kb-tool.ts` | vapi-dashboard/scripts/ | VAPI configuration |

## Rollback

To revert to Gemini query tool:

```bash
# Get current assistant config
curl -X GET https://api.vapi.ai/assistant/756e9d05-80e3-4922-99a5-928277d93206 \
  -H "Authorization: Bearer $VAPI_API_KEY"

# Update toolIds to include old query tool, remove new KB tool
curl -X PATCH https://api.vapi.ai/assistant/756e9d05-80e3-4922-99a5-928277d93206 \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"toolIds": ["3129d2a0-23e4-4b31-bfa9-8809a1924a6d"]}'
```
