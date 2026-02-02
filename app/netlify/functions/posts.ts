import type { Handler, HandlerEvent } from "@netlify/functions";
import { PublicKey } from "@solana/web3.js";

interface Post {
  id: string;
  content: string;
  author: string;
  timestamp: number;
  signature: string | null;
  verified: boolean;
}

// In-memory store (resets on cold start, but works for demo)
// For production, use a database like Supabase, PlanetScale, or Redis
const posts: Post[] = [];

// Simple content validation
function isContentValid(content: string): { valid: boolean; reason?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, reason: "Content cannot be empty" };
  }
  if (content.length > 500) {
    return { valid: false, reason: "Content exceeds 500 characters" };
  }
  return { valid: true };
}

// Generate a simple ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // GET - Fetch posts
  if (event.httpMethod === "GET") {
    try {
      const author = event.queryStringParameters?.author;
      const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50"), 100);

      let filteredPosts = [...posts].reverse(); // Newest first

      if (author) {
        filteredPosts = filteredPosts.filter((p) => p.author === author);
      }

      filteredPosts = filteredPosts.slice(0, limit);

      return {
        statusCode: 200,
        headers: { ...headers, "Cache-Control": "no-cache" },
        body: JSON.stringify({
          posts: filteredPosts,
          hasMore: filteredPosts.length === limit,
          total: posts.length,
        }),
      };
    } catch (error) {
      console.error("Error fetching posts:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch posts" }),
      };
    }
  }

  // POST - Create a new post
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      const { content, author, timestamp, signature } = body;

      // Validate required fields
      if (!content || !author) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      // Validate author is a valid pubkey
      try {
        new PublicKey(author);
      } catch {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid author wallet address" }),
        };
      }

      // Validate content
      const contentCheck = isContentValid(content);
      if (!contentCheck.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: contentCheck.reason }),
        };
      }

      // Create post (signature verification skipped for simplicity)
      const post: Post = {
        id: generateId(),
        content: content.trim(),
        author,
        timestamp: timestamp || Date.now(),
        signature,
        verified: !!signature, // Mark as verified if signature provided
      };

      // Store the post
      posts.push(post);

      // Keep only last 1000 posts in memory
      if (posts.length > 1000) {
        posts.shift();
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ post }),
      };
    } catch (error) {
      console.error("Error creating post:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to create post",
          details: error instanceof Error ? error.message : "Unknown error"
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};

export { handler };
