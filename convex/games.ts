import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const createGame = mutation({
  args: {
    judgeId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const gameId = await ctx.db.insert("games", {
      judgeId: args.judgeId,
      name: args.name,
      isActive: false,
      minPoints: 3,
      createdAt: Date.now(),
  reviewStatus: "draft",
    });
    return gameId;
  },
});

// List games created by a specific judge
export const listJudgeGames = query({
  args: { judgeId: v.string() },
  handler: async (ctx, { judgeId }) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_judge", (q) => q.eq("judgeId", judgeId))
      .collect();
    return games.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  },
});

export const getActiveGame = query({
  args: { judgeId: v.string() },
  handler: async (ctx, args) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_judge", (q) => q.eq("judgeId", args.judgeId))
      .collect();
    
    const activeGame = games.find(game => game.isActive);
    return activeGame || null;
  },
});

export const getAnyActiveGame = query({
  args: {},
  handler: async (ctx, args) => {
    const activeGames = await ctx.db
      .query("games")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    
    return activeGames;
  },
});

export const getGameById = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    return await ctx.db.get(gameId);
  },
});

// Update metadata for a game (map)
export const updateGameMeta = mutation({
  args: {
    gameId: v.id("games"),
    title: v.string(),
    description: v.string(),
    area: v.object({
      country: v.optional(v.string()),
      region: v.optional(v.string()),
      city: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, {
      title: args.title,
      description: args.description,
      area: args.area,
    });
  },
});

// Admin-only: update game meta
export const adminUpdateGameMeta = mutation({
  args: {
    adminKey: v.string(),
    gameId: v.id("games"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    area: v.optional(v.object({
      country: v.optional(v.string()),
      region: v.optional(v.string()),
      city: v.optional(v.string()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { adminKey, gameId, ...patch }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    await ctx.db.patch(gameId, patch as any);
  },
});

// Publish or unpublish a game to the store
export const publishGame = mutation({
  args: { gameId: v.id("games"), published: v.boolean() },
  handler: async (ctx, { gameId, published }) => {
    await ctx.db.patch(gameId, { published });
  },
});

// Judge: submit game for moderation (moves to in_review)
export const submitGameForReview = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    await ctx.db.patch(gameId, { reviewStatus: "in_review" });
  },
});

// List published games for the store
export const listPublishedGames = query({
  args: {},
  handler: async (ctx) => {
    // Prefer index when available
    let items: any[] = [];
    try {
      items = await ctx.db
        .query("games")
        .withIndex("by_published", (q) => q.eq("published", true))
        .collect();
    } catch (e) {
      const all = await ctx.db.query("games").collect();
      items = all.filter((g: any) => g.published === true);
    }
  // Only approved games appear in store
  const approved = items.filter((g: any) => g.reviewStatus === "approved");
  return approved.map((g: any) => ({
      _id: g._id,
      title: g.title ?? g.name ?? "Без названия",
      description: g.description ?? "",
      area: g.area ?? {},
      createdBy: g.judgeId,
      isActive: g.isActive,
      _creationTime: g._creationTime,
    }));
  },
});

// Admin: list games with optional review status filter
export const listGamesByReviewStatus = query({
  args: { status: v.optional(v.union(v.literal("draft"), v.literal("in_review"), v.literal("approved"), v.literal("rejected"))) },
  handler: async (ctx, { status }) => {
    const all = await ctx.db.query("games").collect();
    if (!status) return all;
    return all.filter((g: any) => g.reviewStatus === status);
  },
});

// Admin: set review status (requires ADMIN_KEY)
export const setGameReviewStatus = mutation({
  args: {
    adminKey: v.string(),
    gameId: v.id("games"),
    reviewStatus: v.union(
      v.literal("draft"),
      v.literal("in_review"),
      v.literal("approved"),
      v.literal("rejected")
    ),
  },
  handler: async (ctx, { adminKey, gameId, reviewStatus }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    await ctx.db.patch(gameId, { reviewStatus });
  },
});

// Admin: publish/unpublish a game (separate from review status)
export const setGamePublished = mutation({
  args: { adminKey: v.string(), gameId: v.id("games"), published: v.boolean() },
  handler: async (ctx, { adminKey, gameId, published }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    await ctx.db.patch(gameId, { published });
  },
});

export const activateGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // Mark the game as active
    await ctx.db.patch(args.gameId, { isActive: true });

    // Ensure there's a visible starting point for players when all points are sequential
    const points = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // If at least one sequential point exists and none of them is active yet,
    // activate the first point in the chain (or the first sequential as a fallback)
    const sequentialPoints = points.filter((p: any) => p.type === "sequential");
    const hasActiveSequential = sequentialPoints.some((p: any) => p.isActive);

    if (sequentialPoints.length > 0 && !hasActiveSequential) {
      const nextIds = new Set(
        sequentialPoints
          .map((p: any) => p.chain?.nextPointId)
          .filter((id: any) => Boolean(id))
      );
      // Start point = sequential point that is not referenced as someone else's nextPointId
      const startPoint = sequentialPoints.find((p: any) => !nextIds.has(p._id)) || sequentialPoints[0];
      await ctx.db.patch(startPoint._id, { isActive: true });
    }
  },
});

export const deactivateGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.gameId, { isActive: false });
  },
});

export const deleteGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    // Delete control points first
    const points = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    await Promise.all(points.map((p: any) => ctx.db.delete(p._id)));
    // Delete game
    await ctx.db.delete(gameId);
  },
});

export const startGame = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.string(),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if player already has progress for this game
    const existing = await ctx.db
      .query("playerProgress")
      .withIndex("by_game_and_player", (q) => 
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();

    if (existing) {
      // Update existing progress
      await ctx.db.patch(existing._id, {
        currentPosition: {
          latitude: args.latitude,
          longitude: args.longitude,
        },
      });
      return existing._id;
    } else {
      // Create new progress
      const progressId = await ctx.db.insert("playerProgress", {
        gameId: args.gameId,
        playerId: args.playerId,
        foundPoints: [],
        currentPosition: {
          latitude: args.latitude,
          longitude: args.longitude,
        },
        isCompleted: false,
        startedAt: Date.now(),
      });
      return progressId;
    }
  },
});