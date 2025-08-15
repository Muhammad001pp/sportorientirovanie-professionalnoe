import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const updatePlayerPosition = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.string(),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("playerProgress")
      .withIndex("by_game_and_player", (q) => 
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();

    if (progress) {
      await ctx.db.patch(progress._id, {
        currentPosition: {
          latitude: args.latitude,
          longitude: args.longitude,
        },
      });
    }
  },
});

export const foundControlPoint = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.string(),
    pointId: v.id("controlPoints"),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("playerProgress")
      .withIndex("by_game_and_player", (q) => 
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();

    if (progress && !progress.foundPoints.includes(args.pointId)) {
      const newFoundPoints = [...progress.foundPoints, args.pointId];
      
      await ctx.db.patch(progress._id, {
        foundPoints: newFoundPoints,
      });

      // Check if this point has a next point in chain
      const point = await ctx.db.get(args.pointId);
      if (point?.chain?.nextPointId) {
        // Activate the next point in the chain
        await ctx.db.patch(point.chain.nextPointId, { isActive: true });
      }

      return newFoundPoints.length;
    }
    return progress?.foundPoints.length || 0;
  },
});

export const getPlayerProgress = query({
  args: {
    gameId: v.id("games"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("playerProgress")
      .withIndex("by_game_and_player", (q) => 
        q.eq("gameId", args.gameId).eq("playerId", args.playerId)
      )
      .first();
    return progress;
  },
});