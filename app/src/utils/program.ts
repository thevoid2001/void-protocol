import { type AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "./void_protocol.json";

// Program ID from the deployed contract
export const PROGRAM_ID = new PublicKey(idl.address);

// Use devnet for now
export const NETWORK = clusterApiUrl("devnet");

export function getProvider(wallet: AnchorWallet) {
  const connection = new Connection(NETWORK, "confirmed");
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

export function getProgram(wallet: AnchorWallet) {
  const provider = getProvider(wallet);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}

export function getReadonlyProgram() {
  const connection = new Connection(NETWORK, "confirmed");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, { connection } as any);
}

/** Derive the PDA address where a proof is stored, given its hash */
export function getProofPDA(hash: Uint8Array): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proof"), hash],
    PROGRAM_ID,
  );
  return pda;
}

export interface ProofData {
  hash: number[];
  owner: PublicKey;
  timestamp: { toNumber: () => number };
  bump: number;
}

/** Derive PDA for a wallet profile */
export function getProfilePDA(wallet: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), wallet.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

/** Derive PDA for a follow relationship */
export function getFollowPDA(follower: PublicKey, following: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("follow"), follower.toBuffer(), following.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}
