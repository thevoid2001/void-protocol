/**
 * End-to-end encryption for Void Drop using ECDH + AES-256-GCM.
 *
 * How it works:
 * 1. Org generates a P-256 keypair. Public key goes on-chain. Private key stays with org.
 * 2. Submitter generates an ephemeral keypair, does ECDH with org's public key to derive
 *    a shared secret, then encrypts with AES-256-GCM.
 * 3. Submitter sends: ephemeral public key + IV + ciphertext (all bundled together).
 * 4. Org uses their private key + ephemeral public key to derive the same shared secret,
 *    then decrypts.
 *
 * The submitter's ephemeral keypair is thrown away. No trace.
 */

export interface EncryptedPayload {
  /** The ephemeral public key (65 bytes uncompressed) */
  ephemeralPublicKey: Uint8Array;
  /** 12-byte initialization vector */
  iv: Uint8Array;
  /** The encrypted data */
  ciphertext: Uint8Array;
}

export interface OrgKeyPair {
  /** Public key to store on-chain (65 bytes uncompressed) */
  publicKey: Uint8Array;
  /** Private key as JWK — org must save this securely */
  privateKeyJwk: JsonWebKey;
}

/** A file attachment in a submission */
export interface SubmissionFile {
  name: string;
  type: string;
  data: Uint8Array;
}

/** The structured plaintext payload before encryption */
export interface SubmissionPayloadPlain {
  message: string;
  files: { name: string; type: string; data: number[] }[];
}

/**
 * Build a structured JSON payload from message + files, then encode as Uint8Array.
 */
export function buildSubmissionPayload(message: string, files: SubmissionFile[]): Uint8Array {
  const payload: SubmissionPayloadPlain = {
    message,
    files: files.map((f) => ({
      name: f.name,
      type: f.type,
      data: Array.from(f.data),
    })),
  };
  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Parse a decrypted Uint8Array back into the structured payload.
 */
export function parseSubmissionPayload(decrypted: Uint8Array): SubmissionPayloadPlain {
  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text) as SubmissionPayloadPlain;
}

/**
 * Generate a new ECDH keypair for an organization.
 * The public key gets stored on-chain. The private key must be saved by the org admin.
 */
export async function generateOrgKeyPair(): Promise<OrgKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return {
    publicKey: new Uint8Array(publicKeyRaw),
    privateKeyJwk,
  };
}

/**
 * Encrypt raw bytes for an organization using their public key.
 * Generates an ephemeral keypair, derives a shared secret via ECDH,
 * then encrypts with AES-256-GCM.
 */
export async function encryptForOrg(
  data: Uint8Array,
  orgPublicKeyBytes: Uint8Array,
): Promise<EncryptedPayload> {
  // Generate throwaway keypair for this submission
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );

  // Import the org's public key
  const orgPublicKey = await crypto.subtle.importKey(
    "raw",
    orgPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  // Derive shared secret → AES key
  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: orgPublicKey },
    ephemeralKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  // Encrypt
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    data,
  );

  // Export the ephemeral public key so org can derive the same shared secret
  const ephemeralPublicRaw = await crypto.subtle.exportKey(
    "raw",
    ephemeralKeyPair.publicKey,
  );

  return {
    ephemeralPublicKey: new Uint8Array(ephemeralPublicRaw),
    iv,
    ciphertext: new Uint8Array(ciphertext),
  };
}

/**
 * Decrypt a submission using the org's private key. Returns raw bytes.
 */
export async function decryptSubmission(
  payload: EncryptedPayload,
  orgPrivateKeyJwk: JsonWebKey,
): Promise<Uint8Array> {
  // Import org's private key
  const orgPrivateKey = await crypto.subtle.importKey(
    "jwk",
    orgPrivateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );

  // Import submitter's ephemeral public key
  const ephemeralPublicKey = await crypto.subtle.importKey(
    "raw",
    payload.ephemeralPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  // Derive the same shared secret
  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: ephemeralPublicKey },
    orgPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: payload.iv },
    sharedKey,
    payload.ciphertext,
  );

  return new Uint8Array(decrypted);
}

/**
 * Pack an encrypted payload into a single Uint8Array for storage.
 * Format: [65 bytes ephemeral key] [12 bytes IV] [rest is ciphertext]
 */
export function packPayload(payload: EncryptedPayload): Uint8Array {
  const packed = new Uint8Array(
    65 + 12 + payload.ciphertext.length,
  );
  packed.set(payload.ephemeralPublicKey, 0);
  packed.set(payload.iv, 65);
  packed.set(payload.ciphertext, 65 + 12);
  return packed;
}

/**
 * Unpack a stored payload back into its components.
 */
export function unpackPayload(packed: Uint8Array): EncryptedPayload {
  return {
    ephemeralPublicKey: packed.slice(0, 65),
    iv: packed.slice(65, 65 + 12),
    ciphertext: packed.slice(65 + 12),
  };
}

