import { Link } from "react-router-dom";
import { useFeedData } from "../utils/useFeedData.ts";

export function FeedSavedPage() {
  const { savedArticles, removeSavedArticle } = useFeedData();

  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link to="/feed" className="text-[#888888] transition hover:text-white">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold">Saved Articles</h1>
        {savedArticles.length > 0 && (
          <span className="text-[#888888]">({savedArticles.length})</span>
        )}
      </div>

      {/* Saved articles list */}
      {savedArticles.length === 0 ? (
        <div className="rounded-lg border border-void-border p-8 text-center">
          <div className="mb-4 text-4xl opacity-30">📚</div>
          <p className="text-[#888888]">No saved articles yet.</p>
          <p className="mt-2 text-sm text-[#505050]">
            Click the bookmark icon on any article to save it for later.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedArticles.map((article) => (
            <article
              key={article.id}
              className="group rounded-lg border border-void-border p-4 transition hover:border-[#333]"
            >
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <h2 className="mb-1 text-base font-medium leading-snug text-white group-hover:text-void-accent">
                  {article.title}
                </h2>
                <p className="mb-2 text-xs text-[#888888]">
                  {article.sourceName} · Saved {formatTime(article.savedAt)}
                </p>
                {article.contentSnippet && (
                  <p className="text-sm leading-relaxed text-[#888888] line-clamp-2">
                    {article.contentSnippet}
                  </p>
                )}
              </a>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => removeSavedArticle(article.id)}
                  className="rounded p-1.5 text-sm text-[#505050] transition hover:text-void-error"
                  title="Remove from saved"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
