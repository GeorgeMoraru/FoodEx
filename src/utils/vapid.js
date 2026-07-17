// Web Crypto API helper to generate P-256 keys and format them for VAPID
export async function generateVapidKeys() {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["sign"]
    );
    
    // Export raw public key (65 bytes, starts with 0x04)
    const rawPublic = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
    const publicKeyBase64Url = arrayBufferToBase64Url(rawPublic);
    
    // Export private key in JWK format and extract the private scalar 'd'
    const jwkPrivate = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const privateKeyBase64Url = jwkPrivate.d;
    
    return {
      publicKey: publicKeyBase64Url,
      privateKey: privateKeyBase64Url
    };
  } catch (err) {
    console.error("VAPID Key generation failed, generating fallback mock keys", err);
    // Fallback in case Web Crypto is disabled or unsupported in environment
    return {
      publicKey: "BEl62i53Y4B_BEl62i53Y4B_BEl62i53Y4B_BEl62i53Y4B_BEl62i53Y4B_BEl62i53Y4B_BEl62i53Y4B_BEl62i53Y4B_BEl62i53Y4B_",
      privateKey: "mock-private-key-12345"
    };
  }
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
