import { useState, useEffect, useCallback } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgram, getFollowPDA, getProfilePDA, PROGRAM_ID } from "../utils/program.ts";

const STORAGE_KEY = "void-social-following";

export function useFollowing() {
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  // Local state (localStorage fallback + cache)
  const [following, setFollowing] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(following));
    } catch {
      // localStorage not available
    }
  }, [following]);

  // Check on-chain follow status for a specific address
  const checkOnChainFollow = useCallback(
    async (targetAddress: string): Promise<boolean> => {
      if (!anchorWallet) return false;
      try {
        const targetPubkey = new PublicKey(targetAddress);
        const followPDA = getFollowPDA(anchorWallet.publicKey, targetPubkey);
        const info = await connection.getAccountInfo(followPDA);
        return info !== null;
      } catch {
        return false;
      }
    },
    [anchorWallet, connection]
  );

  // Follow on-chain + local
  const follow = useCallback(
    async (address: string) => {
      // Update local state immediately
      setFollowing((prev) => {
        if (prev.includes(address)) return prev;
        return [...prev, address];
      });

      // Try on-chain follow
      if (anchorWallet) {
        setLoading(true);
        try {
          const program = getProgram(anchorWallet);
          const targetPubkey = new PublicKey(address);
          const followPDA = getFollowPDA(anchorWallet.publicKey, targetPubkey);
          const followerProfilePDA = getProfilePDA(anchorWallet.publicKey);
          const targetProfilePDA = getProfilePDA(targetPubkey);

          // Check if already following on-chain
          const existingFollow = await connection.getAccountInfo(followPDA);
          if (existingFollow) return; // Already following on-chain

          // Check if target has a profile
          const targetProfile = await connection.getAccountInfo(targetProfilePDA);
          if (!targetProfile) {
            // Target doesn't have an on-chain profile, just keep local
            return;
          }

          // Check if follower has a profile
          const followerProfile = await connection.getAccountInfo(followerProfilePDA);
          if (!followerProfile) {
            // Create profile first
            await program.methods
              .createProfile()
              .accounts({
                profile: followerProfilePDA,
                wallet: anchorWallet.publicKey,
                systemProgram: SystemProgram.programId,
              })
              .rpc();
          }

          await program.methods
            .follow()
            .accounts({
              follow: followPDA,
              followerProfile: followerProfilePDA,
              targetProfile: targetProfilePDA,
              follower: anchorWallet.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
        } catch (e) {
          console.error("On-chain follow failed (kept local):", e);
          // Keep local follow even if on-chain fails
        } finally {
          setLoading(false);
        }
      }
    },
    [anchorWallet, connection]
  );

  // Unfollow on-chain + local
  const unfollow = useCallback(
    async (address: string) => {
      // Update local state immediately
      setFollowing((prev) => prev.filter((a) => a !== address));

      // Try on-chain unfollow
      if (anchorWallet) {
        setLoading(true);
        try {
          const program = getProgram(anchorWallet);
          const targetPubkey = new PublicKey(address);
          const followPDA = getFollowPDA(anchorWallet.publicKey, targetPubkey);
          const followerProfilePDA = getProfilePDA(anchorWallet.publicKey);
          const targetProfilePDA = getProfilePDA(targetPubkey);

          // Check if following on-chain
          const existingFollow = await connection.getAccountInfo(followPDA);
          if (!existingFollow) return; // Not following on-chain

          await program.methods
            .unfollow()
            .accounts({
              follow: followPDA,
              followerProfile: followerProfilePDA,
              targetProfile: targetProfilePDA,
              follower: anchorWallet.publicKey,
            })
            .rpc();
        } catch (e) {
          console.error("On-chain unfollow failed (kept local):", e);
        } finally {
          setLoading(false);
        }
      }
    },
    [anchorWallet, connection]
  );

  const isFollowing = useCallback(
    (address: string) => following.includes(address),
    [following]
  );

  const toggleFollow = useCallback(
    async (address: string) => {
      if (isFollowing(address)) {
        await unfollow(address);
      } else {
        await follow(address);
      }
    },
    [follow, unfollow, isFollowing]
  );

  return {
    following,
    follow,
    unfollow,
    isFollowing,
    toggleFollow,
    followingCount: following.length,
    loading,
    checkOnChainFollow,
  };
}
