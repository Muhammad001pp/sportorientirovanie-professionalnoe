// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Подмена импорта 'expo/AppEntry' на локальный index.js (expo-router/entry)
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
	const normalized = String(moduleName).replace(/\\/g, '/');
	const matchesAppEntry =
		normalized === 'expo/AppEntry' ||
		/(^|\/)expo\/AppEntry(\.js)?$/.test(normalized) ||
		/(^|\/)node_modules\/expo\/AppEntry(\.js)?$/.test(normalized);
	if (matchesAppEntry) {
		return {
			type: 'sourceFile',
			filePath: path.resolve(__dirname, 'index.js'),
		};
	}
	if (typeof originalResolveRequest === 'function') {
		return originalResolveRequest(context, moduleName, platform);
	}
	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
// Также переписываем параметр entryFile в HTTP-запросах Metro
config.server = config.server || {};
const originalEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
	const base = typeof originalEnhance === 'function' ? originalEnhance(middleware, server) : middleware;
	return (req, res, next) => {
		try {
			if (req && typeof req.url === 'string') {
				let updated = false;
				if (req.url.includes('entryFile=')) {
					const url = new URL(req.url, 'http://localhost');
					const entryFile = url.searchParams.get('entryFile');
					if (entryFile && /AppEntry/.test(entryFile)) {
						url.searchParams.set('entryFile', 'index.js');
						req.url = url.pathname + url.search;
						updated = true;
					}
				}
				// Грубая подмена любых упоминаний AppEntry
				if (!updated && /AppEntry/.test(req.url)) {
					req.url = req.url.replace(/AppEntry[^&]*/g, 'index.js');
					updated = true;
				}
				if (updated) {
					console.log('[metro] Rewrote request to index.js:', req.url);
				}
			}
		} catch {}
		return base(req, res, next);
	};
};