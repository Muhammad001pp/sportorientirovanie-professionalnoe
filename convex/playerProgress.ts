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
    // Ensure point exists and belongs to the same game
    const point = await ctx.db.get(args.pointId);
    if (!point || point.gameId !== args.gameId) return 0;

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

      // Activate next point in chain if exists
      if (point?.chain?.nextPointId) {
        // Activate the next point in the chain
        await ctx.db.patch(point.chain.nextPointId, { isActive: true });
      }

      // Check completion: all points for this game are found
    const allPoints = await ctx.db
        .query("controlPoints")
        .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
        .collect();
    const allIds = new Set(allPoints.map((p: any) => p._id));
    const uniqueFound = Array.from(new Set(newFoundPoints));
    const foundAll = uniqueFound.filter((id: any) => allIds.has(id)).length === allPoints.length && allPoints.length > 0;
      if (foundAll && !progress.isCompleted) {
        await ctx.db.patch(progress._id, { isCompleted: true, completedAt: Date.now() });
      }

    // Return updated length
    return uniqueFound.length;
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
    if (!progress) return null as any;

    // Sanitize foundPoints: keep only ids of existing points for this game
    const points = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    const allowedIds = new Set(points.map((p: any) => p._id));
    const filtered = progress.foundPoints.filter((id: any) => allowedIds.has(id));
    if (filtered.length !== progress.foundPoints.length) {
      // В query нельзя изменять БД — возвращаем санитизированные данные
      return { ...progress, foundPoints: filtered } as any;
    }
    return progress;
  },
});

// Admin: live snapshot of players and points for a game
export const getGameLiveSnapshot = query({
  args: { adminKey: v.string(), gameId: v.id("games") },
  handler: async (ctx, { adminKey, gameId }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");

    const points = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();

  // No dedicated by_game index — collect all and filter (datasets are small in admin view)
  const allProgress = await ctx.db.query("playerProgress").collect();
  const progresses = allProgress.filter((p: any) => p.gameId === gameId);

    return {
      points: points.map((p: any) => ({
        _id: p._id,
        latitude: p.latitude,
        longitude: p.longitude,
        type: p.type,
        isActive: p.isActive,
      })),
      players: progresses
        .filter((p: any) => p.currentPosition)
        .map((p: any) => ({
          playerId: p.playerId,
          latitude: p.currentPosition.latitude,
          longitude: p.currentPosition.longitude,
        })),
    };
  },
});

// List all progresses for a specific player
export const getAllByPlayer = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    try {
      const items = await ctx.db
        .query("playerProgress")
        .withIndex("by_player", (q) => q.eq("playerId", playerId))
        .collect();
      return items;
    } catch (e) {
      // fallback if index not available
      const all = await ctx.db.query("playerProgress").collect();
      return all.filter((p: any) => p.playerId === playerId);
    }
  },
});

// Summaries with computed completion (server-side), resilient to legacy data without isCompleted
export const getPlayerSummaries = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    // get all progresses by player
    const progresses = await ctx.db
      .query("playerProgress")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .collect();

    // group distinct gameIds
    const gameIds = Array.from(new Set(progresses.map((p: any) => p.gameId)));
    const counts: Record<string, number> = {};
    const gameMeta: Record<string, any> = {};
    for (const gid of gameIds) {
      const [pts, game] = await Promise.all([
        ctx.db
          .query("controlPoints")
          .withIndex("by_game", (q) => q.eq("gameId", gid as any))
          .collect(),
        ctx.db.get(gid as any),
      ]);
      counts[String(gid)] = pts.length;
      gameMeta[String(gid)] = game;
    }

    return progresses.map((p: any) => {
      const total = counts[String(p.gameId)] ?? 0;
      const uniqueFound = Array.from(new Set(p.foundPoints || []));
      const computedCompleted = total > 0 && uniqueFound.length >= total;
      const g = gameMeta[String(p.gameId)];
      return {
        _id: p._id,
        gameId: p.gameId,
        playerId: p.playerId,
        foundPoints: p.foundPoints,
        isCompleted: p.isCompleted || computedCompleted,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        totalPoints: total,
        foundCount: uniqueFound.length,
        gameTitle: g?.title ?? g?.name ?? "Без названия",
        gameArea: g?.area ?? null,
      };
    });
  },
});