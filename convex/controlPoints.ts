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

export const activateControlPoint = mutation({
  args: { pointId: v.id("controlPoints") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pointId, { isActive: true });
  },
});

export const deleteControlPoint = mutation({
  args: { pointId: v.id("controlPoints") },
  handler: async (ctx, args) => {
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