import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Register or update player profile by device/user id
export const upsertPlayer = mutation({
	args: {
		deviceId: v.string(),
		publicNick: v.string(),
		fullName: v.string(),
		phone: v.string(),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("players")
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
		const id = await ctx.db.insert("players", {
			deviceId: args.deviceId,
			publicNick: args.publicNick,
			fullName: args.fullName,
			phone: args.phone,
			email: args.email,
			passwordHash: "",
			status: "pending",
			createdAt: Date.now(),
		});
		return id;
	},
});

// Get player profile for this device/user
export const getPlayer = query({
	args: { deviceId: v.string() },
	handler: async (ctx, { deviceId }) => {
		return await ctx.db
			.query("players")
			.withIndex("by_device", (q) => q.eq("deviceId", deviceId))
			.first();
	},
});

// Admin: list and moderate players
export const listPlayers = query({
	args: {
		adminKey: v.string(),
		status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
	},
	handler: async (ctx, { adminKey, status }) => {
		if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
		if (status) {
			return await ctx.db
				.query("players")
				.withIndex("by_status", (q) => q.eq("status", status))
				.collect();
		}
		const [pending, approved, rejected] = await Promise.all([
			ctx.db.query("players").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
			ctx.db.query("players").withIndex("by_status", (q) => q.eq("status", "approved")).collect(),
			ctx.db.query("players").withIndex("by_status", (q) => q.eq("status", "rejected")).collect(),
		]);
		return [...pending, ...approved, ...rejected];
	},
});

export const setPlayerStatus = mutation({
	args: {
		adminKey: v.string(),
		playerId: v.id("players"),
		status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
	},
	handler: async (ctx, { adminKey, playerId, status }) => {
		if (adminKey !== process.env.ADMIN_KEY) throw new Error("Forbidden");
		await ctx.db.patch(playerId, { status });
	},
});

// Player self-registration with client-side password hash
export const registerPlayer = mutation({
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
			.query("players")
			.withIndex("by_nick", (q) => q.eq("publicNick", args.publicNick))
			.first();
		if (nickTaken && nickTaken.deviceId !== args.deviceId) {
			throw new Error("Никнейм уже занят");
		}

		const existingByDevice = await ctx.db
			.query("players")
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

		return await ctx.db.insert("players", {
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

// Player login by nickname and password hash
export const loginPlayer = query({
	args: { publicNick: v.string(), passwordHash: v.string() },
	handler: async (ctx, { publicNick, passwordHash }) => {
		const player = await ctx.db
			.query("players")
			.withIndex("by_nick", (q) => q.eq("publicNick", publicNick))
			.first();
		if (!player || !player.passwordHash) {
			return { success: false, error: "Пользователь не найден" } as const;
		}
		if (player.passwordHash !== passwordHash) {
			return { success: false, error: "Неверный пароль" } as const;
		}
		return {
			success: true,
			status: player.status,
			playerId: player._id,
			deviceId: player.deviceId,
		} as const;
	},
});
