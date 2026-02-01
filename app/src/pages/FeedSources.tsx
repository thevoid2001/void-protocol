import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  useFeedData,
  searchFeeds,
  detectFeeds,
  IndexedFeed,
  DetectedFeed,
} from "../utils/useFeedData.ts";

export function FeedSourcesPage() {
  const {
    topics,
    sources,
    createTopic,
    renameTopic,
    removeTopic,
    createSource,
    deleteSource,
    exportOPML,
    importOPML,
  } = useFeedData();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState("");

  // Add source modal state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IndexedFeed[]>([]);
  const [detectedFeeds, setDetectedFeeds] = useState<DetectedFeed[]>([]);
  const [detectedSiteTitle, setDetectedSiteTitle] = useState("");
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<{
    name: string;
    feedUrl: string;
    siteUrl: string;
  } | null>(null);
  const [targetTopicId, setTargetTopicId] = useState("");

  // Search feeds
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    // Check if it's a URL
    if (searchQuery.startsWith("http://") || searchQuery.startsWith("https://")) {
      setDetecting(true);
      setSearchResults([]);
      const result = await detectFeeds(searchQuery);
      setDetectedSiteTitle(result.siteTitle);
      setDetectedFeeds(result.feeds);
      setDetecting(false);
    } else {
      setSearching(true);
      setDetectedFeeds([]);
      const results = await searchFeeds(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }
  }, [searchQuery]);

  // Add a feed from search results
  const handleAddFeed = (feed: IndexedFeed) => {
    setSelectedFeed({
      name: feed.name,
      feedUrl: feed.feedUrl,
      siteUrl: feed.siteUrl,
    });
  };

  // Add a detected feed
  const handleAddDetected = (feed: DetectedFeed) => {
    setSelectedFeed({
      name: detectedSiteTitle || "RSS Feed",
      feedUrl: feed.url,
      siteUrl: searchQuery,
    });
  };

  // Confirm adding the selected feed
  const confirmAddFeed = () => {
    if (!selectedFeed) return;

    createSource({
      topicId: targetTopicId,
      name: selectedFeed.name,
      feedUrl: selectedFeed.feedUrl,
      siteUrl: selectedFeed.siteUrl,
    });

    // Reset modal state
    setSelectedFeed(null);
    setTargetTopicId("");
    setSearchQuery("");
    setSearchResults([]);
    setDetectedFeeds([]);
    setShowAddModal(false);
  };

  // Create new topic
  const handleCreateTopic = () => {
    if (!newTopicName.trim()) return;
    createTopic(newTopicName.trim());
    setNewTopicName("");
    setShowTopicModal(false);
  };

  // Rename topic
  const handleRenameTopic = (topicId: string) => {
    if (!newTopicName.trim()) return;
    renameTopic(topicId, newTopicName.trim());
    setNewTopicName("");
    setEditingTopic(null);
  };

  // Export OPML
  const handleExport = () => {
    const opml = exportOPML();
    const blob = new Blob([opml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "void-feed-subscriptions.opml";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import OPML
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".opml,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      importOPML(text);
    };
    input.click();
  };

  // Group sources by topic
  const sourcesByTopic = topics.map((topic) => ({
    topic,
    sources: sources.filter((s) => s.topicId === topic.id),
  }));
  const orphanSources = sources.filter(
    (s) => !topics.some((t) => t.id === s.topicId)
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/feed"
            className="text-[#888888] transition hover:text-white"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold">Sources</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90"
        >
          Add Source
        </button>
      </div>

      {/* Topics and sources */}
      <div className="space-y-6">
        {sourcesByTopic.map(({ topic, sources: topicSources }) => (
          <div key={topic.id} className="rounded-lg border border-void-border">
            <div className="flex items-center justify-between border-b border-void-border p-4">
              {editingTopic === topic.id ? (
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameTopic(topic.id)}
                    className="flex-1 rounded bg-void-surface px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-void-accent"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRenameTopic(topic.id)}
                    className="text-sm text-void-accent"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingTopic(null);
                      setNewTopicName("");
                    }}
                    className="text-sm text-[#888888]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="font-medium">
                    {topic.name}{" "}
                    <span className="text-sm text-[#888888]">
                      ({topicSources.length})
                    </span>
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTopic(topic.id);
                        setNewTopicName(topic.name);
                      }}
                      className="text-xs text-[#888888] hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${topic.name}" and all its sources?`)) {
                          removeTopic(topic.id);
                        }
                      }}
                      className="text-xs text-[#888888] hover:text-void-error"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
            {topicSources.length > 0 ? (
              <ul className="divide-y divide-void-border">
                {topicSources.map((source) => (
                  <li
                    key={source.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <div className="text-sm font-medium">{source.name}</div>
                      <div className="text-xs text-[#888888] truncate max-w-xs">
                        {source.feedUrl}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSource(source.id)}
                      className="text-xs text-[#888888] hover:text-void-error"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-[#505050]">No sources in this topic</p>
            )}
          </div>
        ))}

        {/* Orphan sources (no topic) */}
        {orphanSources.length > 0 && (
          <div className="rounded-lg border border-void-border">
            <div className="border-b border-void-border p-4">
              <h2 className="font-medium text-[#888888]">
                Uncategorized ({orphanSources.length})
              </h2>
            </div>
            <ul className="divide-y divide-void-border">
              {orphanSources.map((source) => (
                <li
                  key={source.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <div className="text-sm font-medium">{source.name}</div>
                    <div className="text-xs text-[#888888] truncate max-w-xs">
                      {source.feedUrl}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSource(source.id)}
                    className="text-xs text-[#888888] hover:text-void-error"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {sources.length === 0 && (
          <div className="rounded-lg border border-void-border p-8 text-center">
            <p className="text-[#888888]">No sources yet. Add some to get started.</p>
          </div>
        )}
      </div>

      {/* Add topic button */}
      <button
        onClick={() => setShowTopicModal(true)}
        className="mt-6 w-full rounded-lg border border-dashed border-void-border p-4 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
      >
        + Add Topic
      </button>

      {/* Data section */}
      <div className="mt-12 border-t border-void-border pt-8">
        <h2 className="mb-4 font-medium text-[#888888]">Data</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
          >
            Export OPML
          </button>
          <button
            onClick={handleImport}
            className="rounded-lg border border-void-border px-4 py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
          >
            Import OPML
          </button>
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-lg border border-void-border bg-void-bg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add a Source</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery("");
                  setSearchResults([]);
                  setDetectedFeeds([]);
                  setSelectedFeed(null);
                }}
                className="text-[#888888] hover:text-white"
              >
                ✕
              </button>
            </div>

            {!selectedFeed ? (
              <>
                {/* Search input */}
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search feeds or paste a URL..."
                    className="flex-1 rounded-lg border border-void-border bg-void-surface px-4 py-2.5 text-sm text-white placeholder-[#505050] outline-none focus:border-void-accent"
                    autoFocus
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || searching || detecting}
                    className="rounded-lg bg-void-accent px-4 py-2 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
                  >
                    {searching || detecting ? "..." : "Go"}
                  </button>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {searchResults.map((feed) => (
                      <div
                        key={feed.id}
                        className="flex items-center justify-between rounded-lg border border-void-border p-3 transition hover:border-[#333]"
                      >
                        <div>
                          <div className="text-sm font-medium">{feed.name}</div>
                          <div className="text-xs text-[#888888]">
                            {feed.description}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddFeed(feed)}
                          className="ml-3 rounded bg-void-accent/20 px-2 py-1 text-xs text-void-accent hover:bg-void-accent/30"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Detected feeds */}
                {detectedFeeds.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-[#888888]">
                      Found {detectedFeeds.length} feed(s) on {detectedSiteTitle}:
                    </p>
                    {detectedFeeds.map((feed, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-void-border p-3"
                      >
                        <div>
                          <div className="text-sm font-medium">{feed.title}</div>
                          <div className="text-xs text-[#888888] truncate max-w-xs">
                            {feed.url}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddDetected(feed)}
                          className="ml-3 rounded bg-void-accent/20 px-2 py-1 text-xs text-void-accent hover:bg-void-accent/30"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* No results */}
                {searchQuery &&
                  !searching &&
                  !detecting &&
                  searchResults.length === 0 &&
                  detectedFeeds.length === 0 && (
                    <p className="text-center text-sm text-[#888888]">
                      No feeds found. Try a different search or URL.
                    </p>
                  )}
              </>
            ) : (
              /* Topic selection */
              <div>
                <p className="mb-4 text-sm text-[#888888]">
                  Adding: <span className="text-white">{selectedFeed.name}</span>
                </p>
                <label className="mb-2 block text-sm text-[#888888]">
                  Add to topic:
                </label>
                <select
                  value={targetTopicId}
                  onChange={(e) => setTargetTopicId(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-void-border bg-void-surface px-4 py-2.5 text-sm text-white outline-none focus:border-void-accent"
                >
                  <option value="">No topic</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedFeed(null)}
                    className="flex-1 rounded-lg border border-void-border py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    onClick={confirmAddFeed}
                    className="flex-1 rounded-lg bg-void-accent py-2 text-sm font-medium text-black transition hover:bg-void-accent/90"
                  >
                    Add Source
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Topic Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-lg border border-void-border bg-void-bg p-6">
            <h2 className="mb-4 text-lg font-semibold">Create Topic</h2>
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTopic()}
              placeholder="Topic name..."
              className="mb-4 w-full rounded-lg border border-void-border bg-void-surface px-4 py-2.5 text-sm text-white placeholder-[#505050] outline-none focus:border-void-accent"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowTopicModal(false);
                  setNewTopicName("");
                }}
                className="flex-1 rounded-lg border border-void-border py-2 text-sm text-[#888888] transition hover:border-[#888888] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTopic}
                disabled={!newTopicName.trim()}
                className="flex-1 rounded-lg bg-void-accent py-2 text-sm font-medium text-black transition hover:bg-void-accent/90 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
