const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function base64ToBytes(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function deriveWrappingKey(password, salt) {
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256"
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function generateAccountKeyBundle(password) {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveWrappingKey(password, salt);
  const encryptedPrivateKey = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    wrappingKey,
    privateKeyBuffer
  );

  return {
    publicKey: bytesToBase64(new Uint8Array(publicKeyBuffer)),
    encryptedPrivateKey: bytesToBase64(new Uint8Array(encryptedPrivateKey)),
    keySalt: bytesToBase64(salt),
    keyIv: bytesToBase64(iv),
    localPrivateKey: bytesToBase64(new Uint8Array(privateKeyBuffer))
  };
}

export async function importLocalPrivateKey(localPrivateKey) {
  return window.crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(localPrivateKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    false,
    ["decrypt"]
  );
}

export async function unlockPrivateKeyFromPassword(bundle, password) {
  const salt = base64ToBytes(bundle.keySalt);
  const iv = base64ToBytes(bundle.keyIv);
  const encryptedPrivateKey = base64ToBytes(bundle.encryptedPrivateKey);
  const wrappingKey = await deriveWrappingKey(password, salt);
  const privateKeyBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    wrappingKey,
    encryptedPrivateKey
  );

  return bytesToBase64(new Uint8Array(privateKeyBuffer));
}

async function importPublicKey(publicKey) {
  return window.crypto.subtle.importKey(
    "spki",
    base64ToBytes(publicKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    false,
    ["encrypt"]
  );
}

export async function createConversationKeyPair(userPublicKey, adminPublicKey) {
  const conversationKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );

  const rawConversationKey = await window.crypto.subtle.exportKey("raw", conversationKey);
  const [userKey, adminKey] = await Promise.all([
    importPublicKey(userPublicKey),
    importPublicKey(adminPublicKey)
  ]);
  const [encryptedUserKey, encryptedAdminKey] = await Promise.all([
    window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, userKey, rawConversationKey),
    window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, adminKey, rawConversationKey)
  ]);

  return {
    conversationKey,
    encryptedKeys: {
      user: bytesToBase64(new Uint8Array(encryptedUserKey)),
      admin: bytesToBase64(new Uint8Array(encryptedAdminKey))
    }
  };
}

export async function getConversationKey(encryptedConversationKey, localPrivateKey) {
  const privateKey = await importLocalPrivateKey(localPrivateKey);
  const rawConversationKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBytes(encryptedConversationKey)
  );

  return window.crypto.subtle.importKey(
    "raw",
    rawConversationKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessageText(text, conversationKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    conversationKey,
    encoder.encode(text)
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptMessageText(payload, conversationKey) {
  const [ivBase64, encryptedBase64] = String(payload || "").split(".");
  if (!ivBase64 || !encryptedBase64) {
    return "[Unable to decrypt message]";
  }

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(ivBase64)
    },
    conversationKey,
    base64ToBytes(encryptedBase64)
  );

  return decoder.decode(decrypted);
}
