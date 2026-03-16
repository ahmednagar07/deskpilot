import { safeStorage } from 'electron';
import * as settingsRepo from '../../database/repositories/settings-repo';
import { getCategoryListForPrompt } from './categories';

export interface GeminiClassification {
  filePath: string;
  categorySlug: string;
  confidence: number;
  reason: string;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const BATCH_SIZE = 20;

/**
 * Get the stored Gemini API key (decrypted from safeStorage).
 */
export function getGeminiApiKey(): string | null {
  const encrypted = settingsRepo.getSetting<string>('gemini_api_key_encrypted');
  if (!encrypted) return null;

  try {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  } catch {
    return null;
  }
}

/**
 * Store the Gemini API key (encrypted via safeStorage).
 */
export function setGeminiApiKey(apiKey: string): void {
  const encrypted = safeStorage.encryptString(apiKey);
  settingsRepo.setSetting('gemini_api_key_encrypted', encrypted.toString('base64'));
}

/**
 * Check if a Gemini API key is configured.
 */
export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey() !== null;
}

/**
 * Classify a batch of file paths using Gemini.
 * Sends up to BATCH_SIZE files per request.
 */
export async function classifyWithGemini(filePaths: string[]): Promise<GeminiClassification[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const results: GeminiClassification[] = [];

  // Process in batches
  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);
    const batchResults = await classifyBatch(batch, apiKey);
    results.push(...batchResults);
  }

  return results;
}

async function classifyBatch(filePaths: string[], apiKey: string): Promise<GeminiClassification[]> {
  const categoryList = getCategoryListForPrompt();

  const fileList = filePaths
    .map((fp, idx) => `${idx + 1}. ${fp}`)
    .join('\n');

  const prompt = `You are a file classifier for a desktop management app. Classify each file into one of these categories based on its path, filename, and extension:

${categoryList}

Files to classify:
${fileList}

Respond with ONLY a JSON array. Each element must have:
- "index": the file number (1-based)
- "category": the category slug (e.g., "clients", "projects", "documents")
- "confidence": a number from 0.0 to 1.0 indicating your confidence
- "reason": a brief explanation (under 20 words)

Example response:
[{"index":1,"category":"clients","confidence":0.85,"reason":"File is in LOC client folder"}]

Respond with ONLY the JSON array, no other text.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      category: string;
      confidence: number;
      reason: string;
    }>;

    return parsed
      .filter(item => item.index >= 1 && item.index <= filePaths.length)
      .map(item => ({
        filePath: filePaths[item.index - 1],
        categorySlug: item.category,
        confidence: Math.min(1, Math.max(0, item.confidence)),
        reason: item.reason,
      }));
  } catch (err) {
    console.error('[Gemini] Classification failed:', err);
    return [];
  }
}
