import { useReadingStats } from "../utils/useReadingStats.ts";

export function ReadingStatsCard() {
  const { getFormattedStats } = useReadingStats();
  const stats = getFormattedStats();

  return (
    <div className="rounded-lg border border-void-border p-4">
      <h3 className="mb-3 text-sm font-medium text-[#888888]">Your Stats</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-semibold text-white">{stats.totalArticles}</p>
          <p className="text-xs text-[#505050]">Articles read</p>
        </div>

        <div>
          <p className="text-2xl font-semibold text-white">{stats.todayRead}</p>
          <p className="text-xs text-[#505050]">Today</p>
        </div>

        <div>
          <p className="text-2xl font-semibold text-void-accent">{stats.streak}</p>
          <p className="text-xs text-[#505050]">Day streak</p>
        </div>

        <div>
          <p className="text-2xl font-semibold text-white">{stats.timeSpent}</p>
          <p className="text-xs text-[#505050]">Time reading</p>
        </div>
      </div>
    </div>
  );
}

export function ReadingStatsBadge() {
  const { getFormattedStats } = useReadingStats();
  const stats = getFormattedStats();

  if (stats.streak === 0) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-void-accent/10 px-2 py-0.5 text-xs text-void-accent">
      <span>🔥</span>
      <span>{stats.streak} day streak</span>
    </div>
  );
}

export function MiniStats() {
  const { getFormattedStats } = useReadingStats();
  const stats = getFormattedStats();

  return (
    <div className="flex items-center gap-4 text-xs text-[#505050]">
      <span>{stats.totalArticles} read</span>
      {stats.streak > 0 && (
        <span className="text-void-accent">🔥 {stats.streak}</span>
      )}
    </div>
  );
}
