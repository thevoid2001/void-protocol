// Cloudflare Pages Function for posts

interface Post {
  id: string;
  content: string;
  author: string;
  timestamp: number;
  signature: string | null;
  verified: boolean;
  replyTo?: string | null; // ID of parent post
}

// In-memory store (resets on cold start - for demo purposes)
// For production, use Cloudflare KV or D1
const posts: Post[] = [];

function isContentValid(content: string): { valid: boolean; reason?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, reason: "Content cannot be empty" };
  }
  if (content.length > 500) {
    return { valid: false, reason: "Content exceeds 500 characters" };
  }
  return { valid: true };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isValidPublicKey(address: string): boolean {
  // Basic Solana public key validation (32 bytes base58)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // GET - Fetch posts
  if (request.method === "GET") {
    const url = new URL(request.url);
    const author = url.searchParams.get("author");
    const authors = url.searchParams.get("authors"); // Comma-separated list for following
    const replyTo = url.searchParams.get("replyTo"); // Get replies to a specific post
    const postId = url.searchParams.get("id"); // Get single post by ID
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    // Get single post by ID
    if (postId) {
      const post = posts.find((p) => p.id === postId);
      if (!post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers }
        );
      }
      return new Response(JSON.stringify({ post }), { headers });
    }

    let filteredPosts = [...posts].reverse();

    // Filter by single author
    if (author) {
      filteredPosts = filteredPosts.filter((p) => p.author === author);
    }

    // Filter by multiple authors (for following feed)
    if (authors) {
      const authorList = authors.split(",").filter(Boolean);
      filteredPosts = filteredPosts.filter((p) => authorList.includes(p.author));
    }

    // Filter by replyTo (get thread replies)
    if (replyTo) {
      filteredPosts = filteredPosts.filter((p) => p.replyTo === replyTo);
    } else {
      // By default, only show top-level posts (not replies) unless specifically requesting replies
      // But if viewing a profile, show all their posts including replies
      if (!author && !authors) {
        filteredPosts = filteredPosts.filter((p) => !p.replyTo);
      }
    }

    filteredPosts = filteredPosts.slice(0, limit);

    // Calculate reply counts for each post
    const postsWithReplyCounts = filteredPosts.map((post) => ({
      ...post,
      replyCount: posts.filter((p) => p.replyTo === post.id).length,
    }));

    return new Response(
      JSON.stringify({
        posts: postsWithReplyCounts,
        hasMore: filteredPosts.length === limit,
        total: posts.length,
      }),
      { headers: { ...headers, "Cache-Control": "no-cache" } }
    );
  }

  // POST - Create a new post
  if (request.method === "POST") {
    try {
      const body = await request.json() as {
        content?: string;
        author?: string;
        timestamp?: number;
        signature?: string | null;
        replyTo?: string | null;
      };
      const { content, author, timestamp, signature, replyTo } = body;

      if (!content || !author) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers }
        );
      }

      if (!isValidPublicKey(author)) {
        return new Response(
          JSON.stringify({ error: "Invalid author wallet address" }),
          { status: 400, headers }
        );
      }

      const contentCheck = isContentValid(content);
      if (!contentCheck.valid) {
        return new Response(
          JSON.stringify({ error: contentCheck.reason }),
          { status: 400, headers }
        );
      }

      // Validate replyTo if provided
      if (replyTo) {
        const parentPost = posts.find((p) => p.id === replyTo);
        if (!parentPost) {
          return new Response(
            JSON.stringify({ error: "Parent post not found" }),
            { status: 400, headers }
          );
        }
      }

      const post: Post = {
        id: generateId(),
        content: content.trim(),
        author,
        timestamp: timestamp || Date.now(),
        signature: signature || null,
        verified: !!signature,
        replyTo: replyTo || null,
      };

      posts.push(post);

      if (posts.length > 1000) {
        posts.shift();
      }

      return new Response(
        JSON.stringify({ post: { ...post, replyCount: 0 } }),
        { status: 201, headers }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Failed to create post" }),
        { status: 500, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers }
  );
};
