const { GoogleGenAI } = require('@google/genai');

let keyIndex = 0;

/**
 * Dynamically retrieves all configured Gemini API keys (GEMINI_API_KEY, GEMINI_API_KEY_1..20)
 */
function getAvailableKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && !keys.includes(k)) {
      keys.push(k);
    }
  }
  return keys;
}

function getNextApiKey() {
  const keys = getAvailableKeys();
  if (keys.length === 0) {
    throw new Error('No GEMINI_API_KEY configured in environment variables.');
  }
  const key = keys[keyIndex % keys.length];
  keyIndex = (keyIndex + 1) % keys.length;
  return key;
}

/**
 * Fallback Strategy:
 * 1. ONLY uses 'gemini-3.7-flash' and 'gemini-3.6-flash'.
 * 2. Starts with a randomly selected key for distributed traffic.
 * 3. Attempts 'gemini-3.7-flash' on the active key using natural API execution.
 * 4. If an error occurs, immediately tries 'gemini-3.6-flash' on the SAME key.
 * 5. If both fail on that key, advances to the next key in sequence and repeats (3.7 -> 3.6).
 * 6. The backend maintains total control over error responses; the client waits until completion.
 */
async function callGeminiWithFallback(contentsInput, systemInstruction = '') {
  let lastError = null;
  const keys = getAvailableKeys();

  if (keys.length === 0) {
    throw new Error('No Gemini API keys found in environment. Please set GEMINI_API_KEY in .env');
  }

  const contentsPayload = Array.isArray(contentsInput) ? contentsInput : [contentsInput];

  // Start with a randomly chosen key for optimal load balancing
  const startIdx = Math.floor(Math.random() * keys.length);

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentIdx = (startIdx + attempt) % keys.length;
    const apiKey = keys[currentIdx];
    const keyMasked = apiKey.length > 8 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : 'key';

    const ai = new GoogleGenAI({ apiKey });

    // Step 1: Try gemini-3.7-flash with current key
    try {
      console.log(`[Gemini Engine] Key #${currentIdx + 1} (${keyMasked}) -> Trying gemini-3.7-flash...`);
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: contentsPayload,
        config: {
          systemInstruction: systemInstruction || 'You are an expert AI medical & academic tutor.',
        },
      });

      if (response && response.text) {
        console.log(`[Gemini Engine] Key #${currentIdx + 1} (${keyMasked}) -> gemini-3.7-flash SUCCESS!`);
        return { text: response.text, modelUsed: 'gemini-3.7-flash' };
      }
    } catch (err37) {
      console.warn(`[Gemini Engine] Key #${currentIdx + 1} (${keyMasked}) -> gemini-3.7-flash: ${err37.message || err37}. Trying gemini-3.6-flash on SAME key...`);
      lastError = err37;

      // Step 2: Try gemini-3.6-flash with the SAME key
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: contentsPayload,
          config: {
            systemInstruction: systemInstruction || 'You are an expert AI medical & academic tutor.',
          },
        });

        if (response && response.text) {
          console.log(`[Gemini Engine] Key #${currentIdx + 1} (${keyMasked}) -> gemini-3.6-flash SUCCESS!`);
          return { text: response.text, modelUsed: 'gemini-3.6-flash' };
        }
      } catch (err36) {
        console.warn(`[Gemini Engine] Key #${currentIdx + 1} (${keyMasked}) -> gemini-3.6-flash ALSO failed: ${err36.message || err36}. Trying next key...`);
        lastError = err36;
      }
    }
  }

  // All keys exhausted
  console.error(`[Gemini Engine] All ${keys.length} keys failed for both gemini-3.7-flash and gemini-3.6-flash:`, lastError?.message);
  throw new Error('AI service is temporarily busy. Please try again in a few moments.');
}

// In-memory cache for AI explanations (Max 5,000 items, LRU-like behavior)
const explanationCache = new Map();
const MAX_CACHE_SIZE = 5000;

function getCacheKey(questionText, correctAnswerLetter) {
  const normQ = (questionText || '').trim().toLowerCase().slice(0, 200);
  const normA = (correctAnswerLetter || 'A').trim().toUpperCase();
  return `${normQ}:::${normA}`;
}

/**
 * Generate comprehensive AI explanation for a single question (With caching)
 */
async function generateAiExplanation({ questionText, options, correctAnswerLetter, explanation }) {
  const cacheKey = getCacheKey(questionText, correctAnswerLetter);

  if (explanationCache.has(cacheKey)) {
    return explanationCache.get(cacheKey);
  }

  const prompt = `EXPERT ACADEMIC & MEDICAL TUTOR EXPLANATION GENERATOR:

Question:
"${questionText}"

Options:
${(options || []).map((opt, i) => `${['A', 'B', 'C', 'D', 'E'][i]}. ${opt}`).join('\n')}

Correct Answer: Option ${correctAnswerLetter || 'A'}
${explanation ? `Printed Reference Explanation: "${explanation}"` : ''}

INSTRUCTIONS:
Provide an in-depth, highly educational explanation for this question formatted in clean Markdown. Include:
1. 💡 **Core Concept & Clinical Rationale**: Clear, step-by-step breakdown of the underlying medical/academic principle.
2. ✅ **Why Option ${correctAnswerLetter || 'A'} is Correct**: Detailed explanation of why the correct answer choice is right.
3. ❌ **Why Other Options are Incorrect**: Concise 1-sentence reasons why each of the distractor options is incorrect.
4. 🧠 **Memory Mnemonic / Key Takeaway**: A quick memory trick or bullet point summary to remember this for future exams.`;

  const systemInstruction = 'You are an elite medical professor and exam prep tutor. Provide clear, encouraging, structured explanations.';
  const result = await callGeminiWithFallback(prompt, systemInstruction);

  if (result && result.text) {
    if (explanationCache.size >= MAX_CACHE_SIZE) {
      const firstKey = explanationCache.keys().next().value;
      explanationCache.delete(firstKey);
    }
    explanationCache.set(cacheKey, result.text);
  }

  return result.text;
}

/**
 * Multi-turn conversational AI Tutor chat pre-fed with question context + optional photo attachment
 */
async function chatWithAiTutor({ questionContext, chatHistory = [], userMessage, imageBase64 }) {
  const { questionText, options, correctAnswerLetter, userLetter, explanation } = questionContext || {};

  const contextHeader = `PRE-FED QUESTION CONTEXT:
- Question: "${questionText || 'N/A'}"
- Options: ${(options || []).map((o, i) => `${['A', 'B', 'C', 'D'][i]}. ${o}`).join(', ')}
- Correct Answer: Option ${correctAnswerLetter || 'A'}
- Student's Answer: Option ${userLetter || 'Not answered'}
- Reference Explanation: "${explanation || 'N/A'}"`;

  let conversationTranscript = `${contextHeader}\n\nCONVERSATION HISTORY:\n`;
  chatHistory.forEach((msg) => {
    conversationTranscript += `${msg.sender === 'user' ? 'Student' : 'AI Tutor'}: ${msg.text}\n`;
  });
  conversationTranscript += `Student: ${userMessage}\n\nAI Tutor:`;

  const contentsPayload = [conversationTranscript];

  // Include image attachment if provided
  if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    contentsPayload.push({
      inlineData: {
        data: cleanBase64,
        mimeType: 'image/jpeg'
      }
    });
  }

  const systemInstruction = 'You are a friendly, encouraging AI exam prep tutor. Answer the student\'s follow-up questions clearly, concisely, and accurately based on the pre-fed question context.';
  const result = await callGeminiWithFallback(contentsPayload, systemInstruction);
  return result.text;
}

module.exports = {
  generateAiExplanation,
  chatWithAiTutor
};
