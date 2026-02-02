import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "void-feed-curated-lists";

export interface CuratedList {
  id: string;
  name: string;
  description: string;
  sources: ListSource[];
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
}

export interface ListSource {
  feedUrl: string;
  name: string;
  siteUrl: string;
}

export function useCuratedLists() {
  const [lists, setLists] = useState<CuratedList[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLists(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load curated lists:", e);
    }
  }, []);

  // Save to localStorage
  const saveLists = useCallback((newLists: CuratedList[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLists));
      setLists(newLists);
    } catch (e) {
      console.error("Failed to save curated lists:", e);
    }
  }, []);

  // Create a new list
  const createList = useCallback(
    (name: string, description: string = "") => {
      const newList: CuratedList = {
        id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        description,
        sources: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
      };

      saveLists([...lists, newList]);
      return newList;
    },
    [lists, saveLists]
  );

  // Update a list
  const updateList = useCallback(
    (listId: string, updates: Partial<Pick<CuratedList, "name" | "description" | "isPublic">>) => {
      saveLists(
        lists.map((list) =>
          list.id === listId
            ? { ...list, ...updates, updatedAt: Date.now() }
            : list
        )
      );
    },
    [lists, saveLists]
  );

  // Delete a list
  const deleteList = useCallback(
    (listId: string) => {
      saveLists(lists.filter((list) => list.id !== listId));
    },
    [lists, saveLists]
  );

  // Add source to list
  const addSource = useCallback(
    (listId: string, source: ListSource) => {
      saveLists(
        lists.map((list) => {
          if (list.id !== listId) return list;

          // Don't add duplicates
          if (list.sources.some((s) => s.feedUrl === source.feedUrl)) {
            return list;
          }

          return {
            ...list,
            sources: [...list.sources, source],
            updatedAt: Date.now(),
          };
        })
      );
    },
    [lists, saveLists]
  );

  // Remove source from list
  const removeSource = useCallback(
    (listId: string, feedUrl: string) => {
      saveLists(
        lists.map((list) => {
          if (list.id !== listId) return list;

          return {
            ...list,
            sources: list.sources.filter((s) => s.feedUrl !== feedUrl),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [lists, saveLists]
  );

  // Get a list by ID
  const getList = useCallback(
    (listId: string) => {
      return lists.find((list) => list.id === listId);
    },
    [lists]
  );

  // Export list as shareable JSON
  const exportList = useCallback((listId: string): string | null => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return null;

    const exportData = {
      name: list.name,
      description: list.description,
      sources: list.sources,
      exportedAt: Date.now(),
    };

    return btoa(JSON.stringify(exportData));
  }, [lists]);

  // Import list from shareable code
  const importList = useCallback(
    (code: string): CuratedList | null => {
      try {
        const data = JSON.parse(atob(code));

        if (!data.name || !Array.isArray(data.sources)) {
          return null;
        }

        const newList: CuratedList = {
          id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: data.name,
          description: data.description || "",
          sources: data.sources,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPublic: false,
        };

        saveLists([...lists, newList]);
        return newList;
      } catch (e) {
        console.error("Failed to import list:", e);
        return null;
      }
    },
    [lists, saveLists]
  );

  return {
    lists,
    createList,
    updateList,
    deleteList,
    addSource,
    removeSource,
    getList,
    exportList,
    importList,
  };
}
