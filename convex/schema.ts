import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    judgeId: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    minPoints: v.number(),
    createdAt: v.number(),
  })
    .index("by_judge", ["judgeId"])
    .index("by_active", ["isActive"]),
  
  controlPoints: defineTable({
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
    isActive: v.boolean(),
  }).index("by_game", ["gameId"]),
  
  playerProgress: defineTable({
    gameId: v.id("games"),
    playerId: v.string(),
    foundPoints: v.array(v.id("controlPoints")),
    currentPosition: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
    })),
    isCompleted: v.boolean(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_game_and_player", ["gameId", "playerId"]),
});