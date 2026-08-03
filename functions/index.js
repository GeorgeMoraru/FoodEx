import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';

// API key is read from Firebase Functions config, never exposed to client
const geminiApiKey = defineString('GEMINI_API_KEY');

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

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: "Extract the expiration date from this image. Return ONLY the date in YYYY-MM-DD format. If no clear expiration date is found, return the exact word 'null'."
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
        console.error('Gemini API error:', response.status, errorText);
        throw new HttpsError('internal', `Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      return { date: textResponse || null };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('Gemini proxy error:', err);
      throw new HttpsError('internal', 'Failed to process image.');
    }
  }
);
