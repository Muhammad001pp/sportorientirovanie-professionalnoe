import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Register or update judge profile by device/user id
export const upsertJudge = mutation({
  args: {
    deviceId: v.string(),
    publicNick: v.string(),
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("judges")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        publicNick: args.publicNick,
        fullName: args.fullName,
        phone: args.phone,
        email: args.email,
      });
      return existing._id;
    }
    const id = await ctx.db.insert("judges", {
      deviceId: args.deviceId,
      publicNick: args.publicNick,
      fullName: args.fullName,
      phone: args.phone,
      email: args.email,
  passwordHash: "", // будет установлен при регистрации
      status: "pending",
      createdAt: Date.now(),
    });
    return id;
  },
});

// Get judge profile for this device/user
export const getJudge = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    return await ctx.db
      .query("judges")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .first();
  },
});

// Approve or reject a judge (to be called by developers/admins only)
export const listPendingJudges = query({
  args: { adminKey: v.string() },
  handler: async (ctx, { adminKey }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    return await ctx.db
      .query("judges")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const setJudgeStatus = mutation({
  args: {
    adminKey: v.string(),
    judgeId: v.id("judges"),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, { adminKey, judgeId, status }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    await ctx.db.patch(judgeId, { status });
  },
});

// List judges with optional status filter (admin only)
export const listJudges = query({
  args: {
    adminKey: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, { adminKey, status }) => {
    if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
    if (status) {
      return await ctx.db
        .query("judges")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    }
    // Return all judges grouped by status using indexed queries
    const [pending, approved, rejected] = await Promise.all([
      ctx.db.query("judges").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db.query("judges").withIndex("by_status", (q) => q.eq("status", "approved")).collect(),
      ctx.db.query("judges").withIndex("by_status", (q) => q.eq("status", "rejected")).collect(),
    ]);
    return [...pending, ...approved, ...rejected];
  },
});

// New: Judge self-registration with client-side password hash
export const registerJudge = mutation({
  args: {
    deviceId: v.string(),
    publicNick: v.string(),
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const nickTaken = await ctx.db
      .query("judges")
      .withIndex("by_nick", (q) => q.eq("publicNick", args.publicNick))
      .first();
    if (nickTaken && nickTaken.deviceId !== args.deviceId) {
      throw new Error("Никнейм уже занят");
    }

    const existingByDevice = await ctx.db
      .query("judges")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first();

    if (existingByDevice) {
      await ctx.db.patch(existingByDevice._id, {
        publicNick: args.publicNick,
        fullName: args.fullName,
        phone: args.phone,
        email: args.email,
        passwordHash: args.passwordHash,
        status: "pending",
      });
      return existingByDevice._id;
    }

    return await ctx.db.insert("judges", {
      deviceId: args.deviceId,
      publicNick: args.publicNick,
      fullName: args.fullName,
      phone: args.phone,
      email: args.email,
      passwordHash: args.passwordHash,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// New: Judge login by nickname and password hash
export const loginJudge = query({
  args: { publicNick: v.string(), passwordHash: v.string() },
  handler: async (ctx, { publicNick, passwordHash }) => {
    const judge = await ctx.db
      .query("judges")
      .withIndex("by_nick", (q) => q.eq("publicNick", publicNick))
      .first();
    if (!judge || !judge.passwordHash) {
      return { success: false, error: "Пользователь не найден" };
    }
    if (judge.passwordHash !== passwordHash) {
      return { success: false, error: "Неверный пароль" };
    }
    return {
      success: true,
      status: judge.status,
      judgeId: judge._id,
      deviceId: judge.deviceId,
    } as const;
  },
});
