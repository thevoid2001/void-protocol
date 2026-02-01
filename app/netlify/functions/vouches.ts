import type { Handler, HandlerEvent } from "@netlify/functions";
import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("9wPskrpZiLSb3He3QoLZMEeiBKWJUh7ykGtkb2N7HX9H");
const DEVNET_RPC = "https://api.devnet.solana.com";

// Vouch account discriminator (first 8 bytes of sha256("account:Vouch"))
// We'll fetch all accounts with this discriminator that match the content hash
const VOUCH_DISCRIMINATOR = [180, 171, 211, 232, 245, 183, 203, 175];

async function hashUrl(url: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60", // Cache for 1 minute
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const articleUrl = event.queryStringParameters?.url;

  if (!articleUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing 'url' parameter" }),
    };
  }

  try {
    const connection = new Connection(DEVNET_RPC, "confirmed");
    const contentHash = await hashUrl(articleUrl);

    // Get all program accounts and filter by content_hash
    // Note: This is a simple approach. For production, you'd want an indexer.
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { memcmp: { offset: 0, bytes: Buffer.from(VOUCH_DISCRIMINATOR).toString("base64") } },
        { memcmp: { offset: 8 + 32, bytes: Buffer.from(contentHash).toString("base64") } }, // content_hash is after discriminator + voucher pubkey
      ],
    });

    // Extract voucher pubkeys
    const vouchers = accounts.map((account) => {
      // Layout: 8 discriminator + 32 voucher + 32 content_hash + 8 timestamp + 1 bump
      const data = account.account.data;
      const voucherPubkey = new PublicKey(data.slice(8, 40));
      const timestamp = data.readBigInt64LE(72);
      return {
        wallet: voucherPubkey.toBase58(),
        timestamp: Number(timestamp) * 1000, // Convert to ms
      };
    });

    // Sort by most recent first
    vouchers.sort((a, b) => b.timestamp - a.timestamp);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: articleUrl,
        count: vouchers.length,
        vouchers: vouchers.slice(0, 50), // Limit to 50 most recent
      }),
    };
  } catch (error) {
    console.error("Error fetching vouches:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to fetch vouches",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

export { handler };
