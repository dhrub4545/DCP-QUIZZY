const { GoogleGenAI } = require('@google/genai');

let keyIndex = 0;

function getAvailableKeys() {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6
  ].filter(Boolean);
}

function getNextApiKey() {
  const keys = getAvailableKeys();
  if (keys.length === 0) {
    throw new Error('No GEMINI_API_KEY configured in environment.');
  }
  const key = keys[keyIndex % keys.length];
  keyIndex = (keyIndex + 1) % keys.length;
  return key;
}

const TARGET_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/**
 * Execute a Gemini AI call using ONLY Gemini 3.6 Flash model across all available Gemini API keys.
 * If an error occurs on one key, automatically tries the next Gemini key.
 */
async function callGeminiWithFallback(prompt, systemInstruction = '') {
  let lastError = null;
  const keys = getAvailableKeys();

  if (keys.length === 0) {
    throw new Error('No Gemini API keys found in environment. Please set GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.');
  }

  // Try each Gemini key in sequence
  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
    const apiKey = getNextApiKey();
    const keyMasked = apiKey.length > 8 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : 'key';

    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: TARGET_MODEL,
        contents: [prompt],
        config: {
          systemInstruction: systemInstruction || 'You are an expert AI medical & academic tutor.',
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
          ]
        }
      });

      if (res && res.text) {
        return { text: res.text, modelUsed: TARGET_MODEL };
      }
    } catch (err) {
      console.warn(`[Gemini Engine] Key ${keyMasked} failed (${err.message}). Trying next Gemini key...`);
      lastError = err;
    }
  }

  throw new Error(`All ${keys.length} Gemini API keys failed for model ${TARGET_MODEL}. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Generate comprehensive AI explanation for a single question
 */
async function generateAiExplanation({ questionText, options, correctAnswerLetter, explanation }) {
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
  return result.text;
}

/**
 * Multi-turn conversational AI Tutor chat pre-fed with question context
 */
async function chatWithAiTutor({ questionContext, chatHistory = [], userMessage }) {
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

  const systemInstruction = 'You are a friendly, encouraging AI exam prep tutor. Answer the student\'s follow-up questions clearly, concisely, and accurately based on the pre-fed question context.';
  const result = await callGeminiWithFallback(conversationTranscript, systemInstruction);
  return result.text;
}

module.exports = {
  generateAiExplanation,
  chatWithAiTutor
};
