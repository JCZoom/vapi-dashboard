#!/usr/bin/env node
/**
 * Convert Freshdesk KB JSON to clean text and upload to Vapi
 * Usage: VAPI_API_KEY=xxx node upload-kb-to-vapi.js
 */

const fs = require('fs');
const path = require('path');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const KB_JSON_PATH = '/Users/Jeffrey.Coy/Projects/freshchat-poc/kb/freshdesk_articles.json';
const OUTPUT_PATH = '/Users/Jeffrey.Coy/CascadeProjects/vapi-dashboard/scripts/kb_articles.txt';

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function convertKbToText() {
  console.log('📚 Loading KB JSON...');
  const data = JSON.parse(fs.readFileSync(KB_JSON_PATH, 'utf-8'));
  
  console.log(`📄 Processing ${data.article_count} articles...`);
  
  let output = `# iPostal1 Knowledge Base\n`;
  output += `# Generated: ${new Date().toISOString()}\n`;
  output += `# Source: Freshdesk KB (${data.domain})\n`;
  output += `# Articles: ${data.article_count}\n\n`;
  output += `${'='.repeat(80)}\n\n`;
  
  for (const article of data.articles) {
    const title = article.title || 'Untitled';
    const content = stripHtml(article.description || '');
    const category = article.category_name || article.folder_name || '';
    
    if (content.length < 20) continue; // Skip empty articles
    
    output += `## ${title}\n`;
    if (category) output += `Category: ${category}\n`;
    output += `\n${content}\n\n`;
    output += `${'-'.repeat(80)}\n\n`;
  }
  
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`✅ Saved to ${OUTPUT_PATH}`);
  console.log(`📊 File size: ${(fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2)} MB`);
  
  return OUTPUT_PATH;
}

async function uploadToVapi(filePath) {
  if (!VAPI_API_KEY) {
    console.error('❌ VAPI_API_KEY environment variable not set');
    console.log('\nTo upload, run:');
    console.log(`  VAPI_API_KEY=your_key node ${path.basename(__filename)}`);
    return null;
  }
  
  console.log('\n📤 Uploading to Vapi...');
  
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  const response = await fetch('https://api.vapi.ai/file', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Upload failed: ${response.status} ${error}`);
    return null;
  }
  
  const result = await response.json();
  console.log('✅ Upload successful!');
  console.log(`   File ID: ${result.id}`);
  console.log(`   Name: ${result.name}`);
  
  return result;
}

async function main() {
  try {
    const filePath = await convertKbToText();
    
    if (VAPI_API_KEY) {
      const result = await uploadToVapi(filePath);
      if (result) {
        console.log('\n🎯 Next steps:');
        console.log('1. Go to Vapi Dashboard → Assistants');
        console.log('2. Select your assistant');
        console.log('3. Under Knowledge Base, add this file ID:');
        console.log(`   ${result.id}`);
      }
    } else {
      console.log('\n📋 To upload to Vapi, run:');
      console.log(`   VAPI_API_KEY=your_key node scripts/upload-kb-to-vapi.js`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
