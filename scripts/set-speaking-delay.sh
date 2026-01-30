#!/bin/bash
# Quick script to update startSpeakingPlan delay on Freddy AI assistant
# Usage: ./scripts/set-speaking-delay.sh 10
#        (sets delay to 10 seconds)

DELAY=${1:-10}
ASSISTANT_ID="756e9d05-80e3-4922-99a5-928277d93206"

# Load API key from .env if exists
if [ -f .env ]; then
  export $(grep VAPI_API_KEY .env | xargs)
fi

if [ -z "$VAPI_API_KEY" ]; then
  echo "❌ VAPI_API_KEY not set. Add to .env or export it."
  exit 1
fi

echo "🔧 Setting startSpeakingPlan.waitSeconds to ${DELAY}s..."

curl -s -X PATCH "https://api.vapi.ai/assistant/${ASSISTANT_ID}" \
  -H "Authorization: Bearer ${VAPI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"startSpeakingPlan\": {
      \"waitSeconds\": ${DELAY},
      \"smartEndpointingEnabled\": true,
      \"transcriptionEndpointingPlan\": {
        \"onPunctuationSeconds\": 0.5,
        \"onNoPunctuationSeconds\": 1.5,
        \"onNumberSeconds\": 0.5
      }
    }
  }" | jq -r '.startSpeakingPlan // "Update sent"'

echo ""
echo "✅ Done! Test a call now - changes are immediate."
