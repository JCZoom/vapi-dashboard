# iPostal1 Voice Bot Demo Questions

**Purpose:** Use these questions to demonstrate the AI assistant's capabilities during stakeholder demos.

**Tips for Demo:**
- Start with Level 1 to show baseline competence
- Progress to Level 2 to show knowledge retrieval
- Use Level 3 to showcase depth and edge case handling
- The bot should now redirect location/pricing questions to the website (by design)

---

## Level 1: Easy (Immediate Answers)

These are straightforward questions the bot should answer confidently without needing to search.

### 1.1 Basic Service Question
> **"What is iPostal1?"**

*Expected:* Brief explanation of virtual mailbox services - receive mail at a real street address, view mail online, request scans/shipping/etc.

### 1.2 Simple How-To
> **"How do I view my mail?"**

*Expected:* Log in to your account or the iPostal1 app, your mail items appear in your inbox with images.

### 1.3 Notification Question
> **"How will I know when I receive mail?"**

*Expected:* You'll receive email notifications and/or push notifications to your phone when new mail arrives.

### 1.4 Basic Action
> **"How do I discard mail I don't want?"**

*Expected:* Select the mail item in your inbox and click/tap "Discard" - it's free and your mail center will dispose of it.

---

## Level 2: Medium (Knowledge Base Search Required)

These questions require the bot to search the knowledge base and synthesize information.

### 2.1 Process Question
> **"How do I get my 1583 form notarized?"**

*Expected (CRITICAL - must be accurate):*
- Only 2 options: proof.com online ($25) OR in person at your mail center
- Should NOT mention banks, UPS, post offices, or other notaries

### 2.2 Cost/Pricing Question
> **"How much does it cost to scan my mail?"**

*Expected:* $2.25 for the first 10 pages, $0.25 for each additional page. Mention scan/shred bundles are available at a discount.

### 2.3 Multi-Step Process
> **"How do I ship multiple mail items together?"**

*Expected:* Explains consolidation - select multiple items, click "Consolidate & Ship" or consolidate first to get a shipping quote, mail center combines them into one package.

### 2.4 Feature Explanation
> **"What is auto-scan and how do I enable it?"**

*Expected:* Auto-scan automatically scans all incoming mail. Enable in Mailbox Settings under Notifications. Scanning fees apply per item.

### 2.5 ID Requirements
> **"What IDs do I need for the Form 1583?"**

*Expected:* Two forms of ID required - primary photo ID (driver's license, passport) and secondary proof of address (lease, mortgage, voter registration). Should mention what's NOT accepted.

---

## Level 3: Hard (Deep Knowledge / Edge Cases)

These questions test the bot's ability to handle complex scenarios and edge cases.

### 3.1 Negative Scenario
> **"I already notarized my 1583 at my bank. Will that work?"**

*Expected (CRITICAL):* No - bank notaries are NOT accepted. You'll need to notarize again using proof.com or at your mail center.

### 3.2 Complex Multi-Part Question
> **"I want to add my spouse to my account so they can receive mail too. What do they need to do?"**

*Expected:* 
- Spouse needs their own Form 1583
- Needs two acceptable IDs
- Can notarize online via proof.com OR in person at your mail center
- Mention $5 discount for additional recipients in same session

### 3.3 Policy Clarification
> **"Can I go to a different iPostal1 location to notarize my form if my location is too far?"**

*Expected:* No - you must notarize at the specific mail center you signed up for, OR use the online notary at proof.com.

### 3.4 Feature Comparison
> **"What's the difference between discarding mail and shredding it?"**

*Expected:*
- Discard: Free, mail goes in regular trash/recycling
- Shred: $2.25, mail is securely shredded - recommended for sensitive documents

### 3.5 Check Deposit Process
> **"Can you help me deposit a check through iPostal1?"**

*Expected:* 
- Yes, check deposit is available ($4.95 plus shipping)
- Check must be scanned first
- Gets mailed to your bank via USPS with tracking
- Up to 5 checks per request

### 3.6 Edge Case - International
> **"I live outside the US. Are there any special requirements for me?"**

*Expected:* Yes - customers outside the US or shipping internationally are required to use the online notary service at proof.com.

---

## Questions That Should Redirect (By Design)

These questions should redirect to the website - this is **correct behavior** showing the guardrails work.

### Location Questions
> **"How many mail centers do you have in California?"**
> **"Which state has the most locations?"**
> **"Where is the nearest mail center to me?"**

*Expected:* Redirects to ipostal1.com location finder

### Pricing/Plan Questions
> **"What are the different plan levels?"**
> **"What's the difference between Standard and Premium?"**

*Expected:* Redirects to ipostal1.com/pricing (plans vary by location)

---

## Demo Flow Suggestion

1. **Warm-up (2 min):** Start with 1.1 and 1.2 to show natural conversation
2. **Core Value (3 min):** Ask 2.1 (notarization) - this is the most important question to get right
3. **Depth (3 min):** Ask 3.1 or 3.2 to show it handles edge cases
4. **Guardrails (1 min):** Ask a location question to show it appropriately redirects
5. **Interrupt test:** At any point, try interrupting mid-response to show responsiveness

---

## Notes for Tomorrow's Demo

- **Personalized greeting** is now working - caller's name should be spoken
- **Interruption** is now more responsive (stops immediately when you speak)
- **Filler messages** added - bot says "One moment please" before KB searches
- **Silence timeout** increased to 60s - bot won't hang up during pauses
