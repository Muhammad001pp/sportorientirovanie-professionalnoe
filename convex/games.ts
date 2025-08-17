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
    });
    return gameId;
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