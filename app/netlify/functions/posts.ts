import type { Handler, HandlerEvent } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

interface Post {
  id: string;
  content: string;
  author: string;
  timestamp: number;
  signature: string | null;
  verified: boolean;
}

// Simple profanity/spam check (basic)
function isContentValid(content: string): { valid: boolean; reason?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, reason: "Content cannot be empty" };
  }
  if (content.length > 500) {
    return { valid: false, reason: "Content exceeds 500 characters" };
  }
  // Add more checks as needed (spam patterns, etc.)
  return { valid: true };
}

// Verify wallet signature
function verifySignature(
  content: string,
  author: string,
  timestamp: number,
  signature: string
): boolean {
  try {
    const payload = JSON.stringify({ content, author, timestamp });
    const message = new TextEncoder().encode(payload);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(author).toBytes();
    return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
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

  // Initialize blob store
  const store = getStore("posts");

  // GET - Fetch posts
  if (event.httpMethod === "GET") {
    try {
      const author = event.queryStringParameters?.author;
      const before = event.queryStringParameters?.before;
      const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50"), 100);

      // Get the post index
      const indexData = await store.get("_index", { type: "json" });
      const index: string[] = (indexData as string[]) || [];

      // Filter and paginate
      let postIds = [...index].reverse(); // Newest first

      if (before) {
        const beforeIdx = postIds.indexOf(before);
        if (beforeIdx !== -1) {
          postIds = postIds.slice(beforeIdx + 1);
        }
      }

      postIds = postIds.slice(0, limit);

      // Fetch posts
      const posts: Post[] = [];
      for (const id of postIds) {
        const post = await store.get(`post:${id}`, { type: "json" });
        if (post) {
          const typedPost = post as Post;
          if (!author || typedPost.author === author) {
            posts.push(typedPost);
          }
        }
      }

      return {
        statusCode: 200,
        headers: { ...headers, "Cache-Control": "public, max-age=10" },
        body: JSON.stringify({
          posts,
          hasMore: postIds.length === limit,
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

      // Verify signature if provided
      let verified = false;
      if (signature) {
        verified = verifySignature(content.trim(), author, timestamp, signature);
      }

      // Create post
      const post: Post = {
        id: generateId(),
        content: content.trim(),
        author,
        timestamp: timestamp || Date.now(),
        signature,
        verified,
      };

      // Store the post
      await store.setJSON(`post:${post.id}`, post);

      // Update the index
      const indexData = await store.get("_index", { type: "json" });
      const index: string[] = (indexData as string[]) || [];
      index.push(post.id);

      // Keep only last 10000 posts
      if (index.length > 10000) {
        const removed = index.shift();
        if (removed) {
          await store.delete(`post:${removed}`);
        }
      }

      await store.setJSON("_index", index);

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
        body: JSON.stringify({ error: "Failed to create post" }),
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
