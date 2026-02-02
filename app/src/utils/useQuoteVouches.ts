import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "void-feed-quote-vouches";

export interface QuoteVouch {
  id: string;
  articleUrl: string;
  articleTitle: string;
  quote: string;
  wallet: string;
  timestamp: number;
}

export function useQuoteVouches() {
  const [quotes, setQuotes] = useState<QuoteVouch[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setQuotes(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load quote vouches:", e);
    }
  }, []);

  // Save to localStorage
  const saveQuotes = useCallback((newQuotes: QuoteVouch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newQuotes));
      setQuotes(newQuotes);
    } catch (e) {
      console.error("Failed to save quote vouches:", e);
    }
  }, []);

  // Add a quote vouch
  const addQuote = useCallback(
    (articleUrl: string, articleTitle: string, quote: string, wallet: string) => {
      const newQuote: QuoteVouch = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        articleUrl,
        articleTitle,
        quote: quote.trim(),
        wallet,
        timestamp: Date.now(),
      };

      saveQuotes([newQuote, ...quotes].slice(0, 500)); // Keep last 500
      return newQuote;
    },
    [quotes, saveQuotes]
  );

  // Get quotes for an article
  const getQuotesForArticle = useCallback(
    (articleUrl: string) => {
      return quotes.filter((q) => q.articleUrl === articleUrl);
    },
    [quotes]
  );

  // Get quotes by wallet
  const getQuotesByWallet = useCallback(
    (wallet: string) => {
      return quotes.filter((q) => q.wallet === wallet);
    },
    [quotes]
  );

  // Get my quote for an article
  const getMyQuote = useCallback(
    (articleUrl: string, wallet: string) => {
      return quotes.find(
        (q) => q.articleUrl === articleUrl && q.wallet === wallet
      );
    },
    [quotes]
  );

  // Remove a quote
  const removeQuote = useCallback(
    (quoteId: string) => {
      saveQuotes(quotes.filter((q) => q.id !== quoteId));
    },
    [quotes, saveQuotes]
  );

  // Get all quotes (for displaying in a feed)
  const getAllQuotes = useCallback(() => {
    return quotes.sort((a, b) => b.timestamp - a.timestamp);
  }, [quotes]);

  return {
    quotes,
    addQuote,
    getQuotesForArticle,
    getQuotesByWallet,
    getMyQuote,
    removeQuote,
    getAllQuotes,
  };
}
