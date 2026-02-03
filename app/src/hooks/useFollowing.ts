import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "void-social-following";

export function useFollowing() {
  const [following, setFollowing] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage when following changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(following));
    } catch {
      // localStorage not available
    }
  }, [following]);

  const follow = useCallback((address: string) => {
    setFollowing((prev) => {
      if (prev.includes(address)) return prev;
      return [...prev, address];
    });
  }, []);

  const unfollow = useCallback((address: string) => {
    setFollowing((prev) => prev.filter((a) => a !== address));
  }, []);

  const isFollowing = useCallback(
    (address: string) => following.includes(address),
    [following]
  );

  const toggleFollow = useCallback(
    (address: string) => {
      if (isFollowing(address)) {
        unfollow(address);
      } else {
        follow(address);
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
  };
}
