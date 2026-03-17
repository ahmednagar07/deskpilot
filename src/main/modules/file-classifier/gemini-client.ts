import { safeStorage } from 'electron';
import * as settingsRepo from '../../database/repositories/settings-repo';
import { getCategoryListForPrompt } from './categories';

export interface GeminiClassification {
  filePath: string;
  categorySlug: string;
  confidence: number;
  reason: string;
}

/** Files the AI is unsure about — needs user input */
export interface ReviewItem {
  filePath: string;
  filename: string;
  aiThinking: string;        // AI's reasoning about why it's uncertain
  bestGuess: string;          // Best category slug guess
  bestGuessConfidence: number;
  alternatives: Array<{      // Other possible categories
    slug: string;
    reason: string;
  }>;
  question: string;           // Question the AI wants to ask the user
}

// Using gemini-3.1-flash-lite-preview: fast, cost-efficient model for file classification
// Stable alternative: gemini-2.5-flash-lite | Docs: https://ai.google.dev/gemini-api/docs/models
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const BATCH_SIZE = 15; // Slightly smaller batches for richer responses
const CONFIDENCE_THRESHOLD = 0.6; // Below this → ask user

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
 * Test the Gemini API connection with sample file paths.
 * Returns the model's response so the user can verify it works.
 */
export async function testGeminiConnection(): Promise<{
  ok: boolean;
  model: string;
  response: Array<{ file: string; category: string; confidence: number; reason: string }>;
  error?: string;
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, model: GEMINI_MODEL, response: [], error: 'No API key configured' };
  }

  // Sample file paths that test different categories
  const testFiles = [
    'C:/Users/Test/Desktop/Work/Clients/LOC/contract_2025.pdf',
    'C:/Users/Test/Downloads/neural_networks_lecture.pptx',
    'G:/hard/Work/Projects/Clawdbot/src/index.ts',
    'C:/Users/Test/Desktop/vacation_photo_2025.jpg',
    'C:/Users/Test/Downloads/nodejs-v20-setup.exe',
  ];

  try {
    const categoryList = getCategoryListForPrompt();
    const fileList = testFiles.map((fp, idx) => `${idx + 1}. ${fp}`).join('\n');
    const prompt = buildClassificationPrompt(categoryList, fileList);
    const text = await callGemini(prompt, apiKey);
    const parsed = extractJsonArray(text) as Array<{
      index: number;
      category: string;
      confidence: number;
      reason: string;
    }>;

    const response = parsed
      .filter(item => item.index >= 1 && item.index <= testFiles.length)
      .map(item => ({
        file: testFiles[item.index - 1].split(/[\\/]/).pop() || testFiles[item.index - 1],
        category: item.category,
        confidence: item.confidence,
        reason: item.reason,
      }));

    return { ok: true, model: GEMINI_MODEL, response };
  } catch (err) {
    return {
      ok: false,
      model: GEMINI_MODEL,
      response: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ClassifyResult {
  classified: GeminiClassification[];
  needsReview: ReviewItem[];
}

/**
 * Smart classification pipeline:
 * 1. Classify files with rich context-aware prompt
 * 2. High-confidence results → auto-classified
 * 3. Low-confidence results → review queue with AI's reasoning + question for user
 */
export async function classifyWithGemini(filePaths: string[]): Promise<ClassifyResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const allClassified: GeminiClassification[] = [];
  const allReview: ReviewItem[] = [];

  // Process in batches
  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);
    const batchResult = await classifyBatch(batch, apiKey);

    // Split by confidence
    for (const item of batchResult) {
      if (item.confidence >= CONFIDENCE_THRESHOLD) {
        allClassified.push(item);
      }
    }

    // Find uncertain ones and get detailed review info
    const uncertainPaths = batchResult
      .filter(item => item.confidence < CONFIDENCE_THRESHOLD)
      .map(item => item.filePath);

    if (uncertainPaths.length > 0) {
      const reviewItems = await investigateUncertainFiles(uncertainPaths, batchResult, apiKey);
      allReview.push(...reviewItems);
    }
  }

  return { classified: allClassified, needsReview: allReview };
}

// ── Build the smart system prompt ────────────────────────────────────

function buildClassificationPrompt(categoryList: string, fileList: string): string {
  return `You are an expert file organization AI for a power user who is a physician, software developer, and designer. You work with multiple clients and projects.

CONTEXT ABOUT THE USER:
- Works with clients: LOC, Banan-Tech, TechAqar, StayCity, Yakz, and others
- Has personal projects: Clawdbot, InBooks, InMind, MegaMind, Numi, DeskPilot
- Medical professional — has research papers, clinical docs, medical references
- Designer — works with Figma, Adobe, Canva; has fonts, graphics, mockups
- Developer — has code repos, configs, databases, scripts across many languages
- Student — has college materials, courses, certifications

YOUR TASK:
Analyze each file path deeply. Don't just look at the extension — investigate:
1. **Parent folder names** — "LOC" means client work, "Clawdbot" means personal project
2. **Path structure** — files in "Work/Clients/" vs "Work/Projects/" vs "Downloads/"
3. **Filename patterns** — "invoice_", "mockup_", "Dr_", "report_" give strong hints
4. **Context clues** — a .pdf in a medical folder is Medicine, but a .pdf in a client folder is Clients
5. **File relationships** — consider what other files in the same directory suggest

AVAILABLE CATEGORIES:
${categoryList}

FILES TO CLASSIFY:
${fileList}

RESPOND WITH ONLY A JSON ARRAY. Each element:
{
  "index": <1-based file number>,
  "category": "<category slug>",
  "confidence": <0.0 to 1.0>,
  "reason": "<your reasoning in 15-25 words — explain WHY, not just WHAT>"
}

CONFIDENCE GUIDE:
- 0.9-1.0: Path/name makes category obvious (e.g., "Work/Clients/LOC/contract.pdf" → clients)
- 0.7-0.89: Strong indicators but some ambiguity (e.g., "project_notes.docx" in Downloads)
- 0.5-0.69: Multiple categories could fit — you're guessing (flag these honestly!)
- 0.1-0.49: Very uncertain — could be anything

BE HONEST about uncertainty. It's better to flag a file as uncertain (low confidence) than to guess wrong. The user will help you with uncertain files.

Respond with ONLY the JSON array, no other text.`;
}

function buildInvestigationPrompt(categoryList: string, fileDetails: string): string {
  return `You are an expert file organization AI helping a user classify files you're uncertain about. The user is a physician, developer, and designer who works with multiple clients and projects.

For each file below, you were unable to confidently classify it. Now investigate deeper and communicate your thinking to the user.

AVAILABLE CATEGORIES:
${categoryList}

UNCERTAIN FILES:
${fileDetails}

For each file, respond with a JSON array where each element has:
{
  "index": <1-based number>,
  "thinking": "<Your detailed reasoning: what you noticed, what's confusing, what clues you found. Write like you're talking to the user. 2-3 sentences.>",
  "best_guess": "<your best category slug>",
  "best_guess_confidence": <0.0-1.0>,
  "alternatives": [
    {"slug": "<another possible category>", "reason": "<why this could fit>"},
    {"slug": "<another option>", "reason": "<why>"}
  ],
  "question": "<A specific, helpful question to ask the user to resolve the ambiguity. Be conversational and specific.>"
}

EXAMPLES OF GOOD QUESTIONS:
- "This looks like it could be a client deliverable or a personal project asset. Is 'TechVision' a client or one of your own projects?"
- "I found a PDF called 'neural_networks_2024.pdf' in your Downloads. Is this for a course you're taking, or medical research?"
- "There are several .sketch files mixed with code files here. Should design assets in project folders stay under Projects, or go to Design?"

EXAMPLES OF BAD QUESTIONS:
- "What category is this?" (too vague)
- "Where should this go?" (not specific)

Be genuinely curious and helpful. Respond with ONLY the JSON array.`;
}

// ── API call helpers ─────────────────────────────────────────────────

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 4096,
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

  return text;
}

function extractJsonArray(text: string): unknown[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in Gemini response');
  }
  return JSON.parse(jsonMatch[0]);
}

// ── Classification batch ─────────────────────────────────────────────

async function classifyBatch(filePaths: string[], apiKey: string): Promise<GeminiClassification[]> {
  const categoryList = getCategoryListForPrompt();
  const fileList = filePaths.map((fp, idx) => `${idx + 1}. ${fp}`).join('\n');
  const prompt = buildClassificationPrompt(categoryList, fileList);

  try {
    const text = await callGemini(prompt, apiKey);
    const parsed = extractJsonArray(text) as Array<{
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
    console.error('[Gemini] Classification batch failed:', err);
    throw err;
  }
}

// ── Investigation pass for uncertain files ───────────────────────────

async function investigateUncertainFiles(
  uncertainPaths: string[],
  originalResults: GeminiClassification[],
  apiKey: string,
): Promise<ReviewItem[]> {
  const categoryList = getCategoryListForPrompt();

  const fileDetails = uncertainPaths.map((fp, idx) => {
    const original = originalResults.find(r => r.filePath === fp);
    const filename = fp.split(/[\\/]/).pop() || fp;
    return `${idx + 1}. Path: ${fp}\n   Filename: ${filename}\n   Initial guess: ${original?.categorySlug || 'unknown'} (confidence: ${original?.confidence?.toFixed(2) || '?'})\n   Initial reason: ${original?.reason || 'none'}`;
  }).join('\n\n');

  const prompt = buildInvestigationPrompt(categoryList, fileDetails);

  try {
    const text = await callGemini(prompt, apiKey);
    const parsed = extractJsonArray(text) as Array<{
      index: number;
      thinking: string;
      best_guess: string;
      best_guess_confidence: number;
      alternatives: Array<{ slug: string; reason: string }>;
      question: string;
    }>;

    return parsed
      .filter(item => item.index >= 1 && item.index <= uncertainPaths.length)
      .map(item => {
        const fp = uncertainPaths[item.index - 1];
        const filename = fp.split(/[\\/]/).pop() || fp;
        return {
          filePath: fp,
          filename,
          aiThinking: item.thinking || 'I need more context to classify this file.',
          bestGuess: item.best_guess,
          bestGuessConfidence: Math.min(1, Math.max(0, item.best_guess_confidence || 0)),
          alternatives: (item.alternatives || []).slice(0, 3),
          question: item.question || 'Which category fits this file best?',
        };
      });
  } catch (err) {
    console.error('[Gemini] Investigation pass failed:', err);
    // Fallback: create basic review items without investigation
    return uncertainPaths.map(fp => {
      const original = originalResults.find(r => r.filePath === fp);
      const filename = fp.split(/[\\/]/).pop() || fp;
      return {
        filePath: fp,
        filename,
        aiThinking: `I couldn't confidently classify "${filename}". The path and name don't give strong enough clues.`,
        bestGuess: original?.categorySlug || 'documents',
        bestGuessConfidence: original?.confidence || 0.3,
        alternatives: [],
        question: `What category should "${filename}" go into?`,
      };
    });
  }
}
