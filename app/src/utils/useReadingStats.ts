import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "void-feed-reading-stats";

interface ReadingStats {
  articlesRead: number;
  linksClicked: number;
  timeSpentMs: number;
  firstReadAt: number;
  lastReadAt: number;
  readArticles: string[]; // URLs of read articles
  dailyStats: Record<string, { read: number; clicked: number }>; // Date string -> stats
}

const DEFAULT_STATS: ReadingStats = {
  articlesRead: 0,
  linksClicked: 0,
  timeSpentMs: 0,
  firstReadAt: 0,
  lastReadAt: 0,
  readArticles: [],
  dailyStats: {},
};

function getDateKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function useReadingStats() {
  const [stats, setStats] = useState<ReadingStats>(DEFAULT_STATS);
  const [sessionStart] = useState(Date.now());

  // Load stats from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setStats(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load reading stats:", e);
    }
  }, []);

  // Save stats to localStorage
  const saveStats = useCallback((newStats: ReadingStats) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
      setStats(newStats);
    } catch (e) {
      console.error("Failed to save reading stats:", e);
    }
  }, []);

  // Track article read
  const trackRead = useCallback((articleUrl: string) => {
    setStats((prev) => {
      // Don't count duplicates
      if (prev.readArticles.includes(articleUrl)) {
        return prev;
      }

      const dateKey = getDateKey();
      const newStats: ReadingStats = {
        ...prev,
        articlesRead: prev.articlesRead + 1,
        lastReadAt: Date.now(),
        firstReadAt: prev.firstReadAt || Date.now(),
        readArticles: [...prev.readArticles.slice(-999), articleUrl], // Keep last 1000
        dailyStats: {
          ...prev.dailyStats,
          [dateKey]: {
            read: (prev.dailyStats[dateKey]?.read || 0) + 1,
            clicked: prev.dailyStats[dateKey]?.clicked || 0,
          },
        },
      };
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  // Track link click
  const trackClick = useCallback(() => {
    setStats((prev) => {
      const dateKey = getDateKey();
      const newStats: ReadingStats = {
        ...prev,
        linksClicked: prev.linksClicked + 1,
        dailyStats: {
          ...prev.dailyStats,
          [dateKey]: {
            read: prev.dailyStats[dateKey]?.read || 0,
            clicked: (prev.dailyStats[dateKey]?.clicked || 0) + 1,
          },
        },
      };
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  // Track time spent (call periodically)
  const trackTime = useCallback((ms: number) => {
    setStats((prev) => {
      const newStats: ReadingStats = {
        ...prev,
        timeSpentMs: prev.timeSpentMs + ms,
      };
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  // Check if article was read
  const isRead = useCallback((articleUrl: string) => {
    return stats.readArticles.includes(articleUrl);
  }, [stats.readArticles]);

  // Get formatted stats
  const getFormattedStats = useCallback(() => {
    const hours = Math.floor(stats.timeSpentMs / 3600000);
    const minutes = Math.floor((stats.timeSpentMs % 3600000) / 60000);

    return {
      totalArticles: stats.articlesRead,
      totalClicks: stats.linksClicked,
      timeSpent: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      streak: calculateStreak(stats.dailyStats),
      todayRead: stats.dailyStats[getDateKey()]?.read || 0,
    };
  }, [stats]);

  // Calculate reading streak
  function calculateStreak(dailyStats: Record<string, { read: number }>): number {
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split("T")[0];

      if (dailyStats[key]?.read > 0) {
        streak++;
      } else if (i > 0) {
        // Allow missing today, but break on any other gap
        break;
      }
    }

    return streak;
  }

  // Reset stats
  const resetStats = useCallback(() => {
    saveStats(DEFAULT_STATS);
  }, [saveStats]);

  return {
    stats,
    trackRead,
    trackClick,
    trackTime,
    isRead,
    getFormattedStats,
    resetStats,
  };
}
