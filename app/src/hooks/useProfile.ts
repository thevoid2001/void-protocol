import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, getProfilePDA, PROGRAM_ID } from "../utils/program.ts";

export interface ProfileData {
  wallet: PublicKey;
  reputationVisible: boolean;
  allowFollowers: boolean;
  totalVouches: number;
  followerCount: number;
  followingCount: number;
  createdAt: number;
}

export function useProfile(walletAddress?: string) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  const targetPubkey = walletAddress
    ? new PublicKey(walletAddress)
    : anchorWallet?.publicKey;

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!targetPubkey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profilePDA = getProfilePDA(targetPubkey);
      const info = await connection.getAccountInfo(profilePDA);

      if (!info) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Use program to decode if we have a wallet
      if (anchorWallet) {
        const program = getProgram(anchorWallet);
        const data = await program.account.walletProfile.fetch(profilePDA);
        setProfile({
          wallet: data.wallet as PublicKey,
          reputationVisible: data.reputationVisible as boolean,
          allowFollowers: data.allowFollowers as boolean,
          totalVouches: (data.totalVouches as { toNumber: () => number }).toNumber(),
          followerCount: (data.followerCount as { toNumber: () => number }).toNumber(),
          followingCount: (data.followingCount as { toNumber: () => number }).toNumber(),
          createdAt: (data.createdAt as { toNumber: () => number }).toNumber() * 1000,
        });
      } else {
        // Profile exists but we can't decode without wallet - just mark as existing
        setProfile({
          wallet: targetPubkey,
          reputationVisible: true,
          allowFollowers: true,
          totalVouches: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt: 0,
        });
      }
    } catch (e) {
      console.error("Failed to fetch profile:", e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [targetPubkey?.toBase58(), anchorWallet, connection]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Create profile on-chain
  const createProfile = useCallback(async () => {
    if (!anchorWallet) return;

    setCreating(true);
    try {
      const program = getProgram(anchorWallet);
      const profilePDA = getProfilePDA(anchorWallet.publicKey);

      await program.methods
        .createProfile()
        .accounts({
          profile: profilePDA,
          wallet: anchorWallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fetchProfile();
    } catch (e) {
      console.error("Create profile failed:", e);
      throw e;
    } finally {
      setCreating(false);
    }
  }, [anchorWallet, fetchProfile]);

  // Update profile settings
  const updateProfile = useCallback(
    async (reputationVisible: boolean, allowFollowers: boolean) => {
      if (!anchorWallet) return;

      setUpdating(true);
      try {
        const program = getProgram(anchorWallet);
        const profilePDA = getProfilePDA(anchorWallet.publicKey);

        await program.methods
          .updateProfile(reputationVisible, allowFollowers)
          .accounts({
            profile: profilePDA,
            wallet: anchorWallet.publicKey,
          })
          .rpc();

        await fetchProfile();
      } catch (e) {
        console.error("Update profile failed:", e);
        throw e;
      } finally {
        setUpdating(false);
      }
    },
    [anchorWallet, fetchProfile]
  );

  return {
    profile,
    loading,
    creating,
    updating,
    createProfile,
    updateProfile,
    refetch: fetchProfile,
    hasProfile: profile !== null,
  };
}
