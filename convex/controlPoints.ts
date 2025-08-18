import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const createControlPoint = mutation({
  args: {
    gameId: v.id("games"),
    type: v.union(v.literal("visible"), v.literal("sequential")),
    latitude: v.number(),
    longitude: v.number(),
    content: v.object({
      qr: v.optional(v.string()),
      hint: v.optional(v.string()),
      symbol: v.optional(v.string()),
    }),
    chain: v.optional(v.object({
      id: v.string(),
      order: v.number(),
      nextPointId: v.optional(v.id("controlPoints")),
    })),
  },
  handler: async (ctx, args) => {
    const pointId = await ctx.db.insert("controlPoints", {
      gameId: args.gameId,
      type: args.type,
      latitude: args.latitude,
      longitude: args.longitude,
      content: args.content,
      chain: args.chain,
      isActive: args.type === "visible",
    });
    return pointId;
  },
});

export const getControlPoints = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const points = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    return points;
  },
});

// Admin: full details of points for a given game (no auth here, оставляем auth на уровне админки, либо добавим adminKey при необходимости)
export const adminGetPointsWithDetails = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const pts = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    return pts.map((p: any) => ({
      _id: p._id,
      type: p.type,
      latitude: p.latitude,
      longitude: p.longitude,
      content: p.content,
      chain: p.chain,
      isActive: p.isActive,
    }));
  },
});

export const countByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const pts = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    return pts.length;
  },
});

export const activateControlPoint = mutation({
  args: { pointId: v.id("controlPoints") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pointId, { isActive: true });
  },
});

export const deleteControlPoint = mutation({
  args: { pointId: v.id("controlPoints") },
  handler: async (ctx, args) => {
    const point = await ctx.db.get(args.pointId);
    if (!point) return;
    // Remove pointId from player progresses of this game
    const progresses = await ctx.db
      .query("playerProgress")
      .withIndex("by_game_and_player", (q) => q.eq("gameId", point.gameId))
      .collect();
    for (const pr of progresses) {
      if ((pr as any).foundPoints?.includes(args.pointId)) {
        const cleaned = (pr as any).foundPoints.filter((id: any) => id !== args.pointId);
        await ctx.db.patch((pr as any)._id, { foundPoints: cleaned });
      }
    }
    await ctx.db.delete(args.pointId);
  },
});

export const updateControlPoint = mutation({
  args: {
    pointId: v.id("controlPoints"),
    content: v.object({
      qr: v.optional(v.string()),
      hint: v.optional(v.string()),
      symbol: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pointId, { content: args.content });
  },
});

export const updateControlPointChain = mutation({
  args: {
    pointId: v.id("controlPoints"),
    nextPointId: v.optional(v.id("controlPoints")),
  },
  handler: async (ctx, args) => {
    const point = await ctx.db.get(args.pointId);
    if (!point) return;
    const newChain = {
      id: point.chain?.id || `chain-${Date.now()}`,
      order: point.chain?.order || 0,
      nextPointId: args.nextPointId,
    } as any;
    await ctx.db.patch(args.pointId, { chain: newChain });
  },
});

export const setStartSequentialPoint = mutation({
  args: { gameId: v.id("games"), pointId: v.id("controlPoints") },
  handler: async (ctx, args) => {
    // Deactivate all sequential points for this game
    const points = await ctx.db
      .query("controlPoints")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    const sequential = points.filter((p: any) => p.type === "sequential");

    await Promise.all(
      sequential.map((p: any) =>
        ctx.db.patch(p._id, { isActive: p._id === args.pointId })
      )
    );
  },
});

// Admin-only: create/update/delete points for any game
export const adminCreateControlPoint = mutation({
  args: {
    adminKey: v.string(),
    gameId: v.id("games"),
    type: v.union(v.literal("visible"), v.literal("sequential")),
    latitude: v.number(),
    longitude: v.number(),
    content: v.object({
      qr: v.optional(v.string()),
      hint: v.optional(v.string()),
      symbol: v.optional(v.string()),
    }),
    chain: v.optional(v.object({
      id: v.string(),
      order: v.number(),
      nextPointId: v.optional(v.id("controlPoints")),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    const pointId = await ctx.db.insert("controlPoints", {
      gameId: args.gameId,
      type: args.type,
      latitude: args.latitude,
      longitude: args.longitude,
      content: args.content,
      chain: args.chain,
      isActive: args.isActive ?? (args.type === "visible"),
    });
    return pointId;
  },
});

export const adminUpdateControlPoint = mutation({
  args: {
    adminKey: v.string(),
    pointId: v.id("controlPoints"),
    patch: v.object({
      type: v.optional(v.union(v.literal("visible"), v.literal("sequential"))),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      content: v.optional(v.object({
        qr: v.optional(v.string()),
        hint: v.optional(v.string()),
        symbol: v.optional(v.string()),
      })),
      chain: v.optional(v.object({
        id: v.string(),
        order: v.number(),
        nextPointId: v.optional(v.id("controlPoints")),
      })),
      isActive: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { adminKey, pointId, patch }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    await ctx.db.patch(pointId, patch as any);
  },
});

export const adminDeleteControlPoint = mutation({
  args: { adminKey: v.string(), pointId: v.id("controlPoints") },
  handler: async (ctx, { adminKey, pointId }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    const point = await ctx.db.get(pointId);
    if (!point) return;
    const progresses = await ctx.db
      .query("playerProgress")
      .withIndex("by_game_and_player", (q) => q.eq("gameId", point.gameId))
      .collect();
    for (const pr of progresses) {
      if ((pr as any).foundPoints?.includes(pointId)) {
        const cleaned = (pr as any).foundPoints.filter((id: any) => id !== pointId);
        await ctx.db.patch((pr as any)._id, { foundPoints: cleaned });
      }
    }
    await ctx.db.delete(pointId);
  },
});