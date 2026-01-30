/**
 * Arweave storage via Irys for Void Drop.
 *
 * Encrypted payloads are uploaded to Arweave through Irys (handles bundling & payment).
 * The Arweave transaction ID is stored on-chain as a pointer.
 * Anyone can fetch the encrypted blob, but only the org admin can decrypt it.
 */

import type { WalletContextState } from "@solana/wallet-adapter-react";

const GATEWAY_URL = "https://gateway.irys.xyz";

let uploaderCache: { address: string; uploader: any } | null = null;

/**
 * Get or create an Irys uploader instance connected to the user's Solana wallet.
 */
async function getUploader(wallet: WalletContextState) {
  if (uploaderCache && uploaderCache.address === wallet.publicKey?.toBase58()) {
    return uploaderCache.uploader;
  }

  const { WebUploader } = await import("@irys/web-upload");
  const { WebSolana } = await import("@irys/web-upload-solana");

  const uploader = await WebUploader(WebSolana).withProvider(wallet);
  uploaderCache = { address: wallet.publicKey!.toBase58(), uploader };
  return uploader;
}

/**
 * Upload an encrypted payload to Arweave via Irys.
 * Returns the Arweave transaction ID.
 */
export async function uploadToArweave(
  wallet: WalletContextState,
  data: Uint8Array,
): Promise<string> {
  const uploader = await getUploader(wallet);

  // Check price and fund if needed
  const price = await uploader.getPrice(data.length);
  const balance = await uploader.getBalance();

  if (price.isGreaterThan(balance)) {
    await uploader.fund(price);
  }

  const receipt = await uploader.upload(data, {
    tags: [
      { name: "Content-Type", value: "application/octet-stream" },
      { name: "App-Name", value: "void-drop" },
      { name: "App-Version", value: "1" },
    ],
  });

  return receipt.id;
}

/**
 * Fetch an encrypted payload from Arweave by transaction ID.
 */
export async function fetchFromArweave(txId: string): Promise<Uint8Array> {
  const response = await fetch(`${GATEWAY_URL}/${txId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch from Arweave: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
