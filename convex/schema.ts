import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    judgeId: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    minPoints: v.number(),
    createdAt: v.number(),
    // New metadata fields for "map store"
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    area: v.optional(v.object({
      country: v.optional(v.string()),
      region: v.optional(v.string()),
      city: v.optional(v.string()),
    })),
    published: v.optional(v.boolean()),
    reviewStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("in_review"),
        v.literal("approved"),
        v.literal("rejected")
      )
    ),
  })
    .index("by_judge", ["judgeId"])
    .index("by_active", ["isActive"]) 
    .index("by_published", ["published"]),
  
  judges: defineTable({
    deviceId: v.string(),
    publicNick: v.string(),
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  }).index("by_device", ["deviceId"]).index("by_status", ["status"]).index("by_nick", ["publicNick"]),

  // Players register/login similar to judges
  players: defineTable({
    deviceId: v.string(),
    publicNick: v.string(),
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  }).index("by_device", ["deviceId"]).index("by_status", ["status"]).index("by_nick", ["publicNick"]),
  
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
  })
    .index("by_game_and_player", ["gameId", "playerId"]) 
    .index("by_player", ["playerId"]),
});