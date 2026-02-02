// Cloudflare Pages Function for vouch counts

const PROGRAM_ID = "9wPskrpZiLSb3He3QoLZMEeiBKWJUh7ykGtkb2N7HX9H";
const DEVNET_RPC = "https://api.devnet.solana.com";

// Vouch account discriminator
const VOUCH_DISCRIMINATOR = [180, 171, 211, 232, 245, 183, 203, 175];

async function hashUrl(url: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

function toBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(request.url);
  const articleUrl = url.searchParams.get("url");

  if (!articleUrl) {
    return new Response(
      JSON.stringify({ error: "Missing 'url' parameter" }),
      { status: 400, headers }
    );
  }

  try {
    const contentHash = await hashUrl(articleUrl);

    // Query Solana for vouch accounts
    const response = await fetch(DEVNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getProgramAccounts",
        params: [
          PROGRAM_ID,
          {
            encoding: "base64",
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: toBase64(VOUCH_DISCRIMINATOR),
                  encoding: "base64",
                },
              },
              {
                memcmp: {
                  offset: 40, // 8 discriminator + 32 voucher pubkey
                  bytes: toBase64(Array.from(contentHash)),
                  encoding: "base64",
                },
              },
            ],
          },
        ],
      }),
    });

    const result = await response.json() as {
      result?: Array<{ pubkey: string; account: { data: [string, string] } }>;
      error?: { message: string };
    };

    if (result.error) {
      throw new Error(result.error.message);
    }

    const accounts = result.result || [];

    // Extract voucher info from accounts
    const vouchers = accounts.map((acc) => {
      const data = Uint8Array.from(atob(acc.account.data[0]), c => c.charCodeAt(0));
      // Layout: 8 discriminator + 32 voucher pubkey + 32 content_hash + 8 timestamp + 1 bump
      const voucherBytes = data.slice(8, 40);
      const voucherPubkey = encodeBase58(voucherBytes);

      // Read timestamp (i64 little endian at offset 72)
      const timestampView = new DataView(data.buffer, 72, 8);
      const timestamp = Number(timestampView.getBigInt64(0, true)) * 1000;

      return {
        wallet: voucherPubkey,
        timestamp,
      };
    });

    // Sort by most recent
    vouchers.sort((a, b) => b.timestamp - a.timestamp);

    return new Response(
      JSON.stringify({
        url: articleUrl,
        count: vouchers.length,
        vouchers: vouchers.slice(0, 50),
      }),
      { headers }
    );
  } catch (error) {
    console.error("Error fetching vouches:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch vouches",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers }
    );
  }
};

// Base58 encoding for Solana public keys
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Handle leading zeros
  for (const byte of bytes) {
    if (byte === 0) digits.push(0);
    else break;
  }

  return digits
    .reverse()
    .map((d) => ALPHABET[d])
    .join("");
}
