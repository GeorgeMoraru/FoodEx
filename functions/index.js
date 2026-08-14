import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// API key is read from Firebase Secret Manager, never exposed to client
const geminiApiKey = defineSecret('GEMINI_API_KEY');

/**
 * Firebase Callable Function that proxies image-based date extraction
 * requests to the Gemini API. This keeps the API key server-side.
 * 
 * Deploy: firebase deploy --only functions
 * Set secret: firebase functions:secrets:set GEMINI_API_KEY
 */
export const extractExpirationDate = onCall(
  {
    maxInstances: 10,
    cors: true,
    secrets: [geminiApiKey],
    enforceAppCheck: false, // Enable App Check in production for extra security
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to use the scanner.');
    }

    const { imageBase64 } = request.data;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', 'imageBase64 is required.');
    }

    // Enforce a reasonable size limit (< 2MB base64)
    if (imageBase64.length > 2 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'Image too large. Max 2MB.');
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('internal', 'Gemini API key not configured on server.');
    }

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro'
    ];
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    text: "Analyze this image of food packaging. Locate any expiration date, best before date, use by date, EXP, BB, or date stamp (e.g. 2026-08-15, 15/08/2026, 15.08.26, 08/26, 15 AUG 2026). Return ONLY the date in YYYY-MM-DD format if possible, or exact date text. If no clear expiration date is found, return the exact word 'null'."
                  },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: imageBase64
                    }
                  }
                ]
              }]
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Gemini API (${modelName}) error:`, response.status, errorText);
          lastError = new HttpsError('internal', `Gemini API (${modelName}) returned status ${response.status}`);
          continue;
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        return { date: textResponse || null };
      } catch (err) {
        console.error(`Error calling Gemini model ${modelName}:`, err);
        lastError = err;
      }
    }

    if (lastError instanceof HttpsError) throw lastError;
    throw new HttpsError('internal', 'Failed to process image with Gemini API.');
  }
);
