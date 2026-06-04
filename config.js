module.exports = {
    CATEGORIES: {
        A: { key: "A", name: "Languages" },
        B: { key: "B", name: "Postcard Writing" },
        // C: { key: "C", name: "Lounge Visit" },
    },
    EVENT_DETAILS: {
        Event: "Other Languages Experience Day: Learn. Showcase. Connect. (學展同樂：其他語言體驗日)",
        Date: "11 July 2026 (Saturday)",
        Time: "10:00 a.m. to 12:00 noon",
        Venue: "WP01, EDB Kowloon Tong Education Services Centre",
    },

    BOOTHS: [
        { key: "french", name: "French", category: "A", stampValue: 1 },
        { key: "german", name: "German", category: "A", stampValue: 1 },
        { key: "japanese", name: "Japanese", category: "A", stampValue: 1 },
        { key: "korean", name: "Korean", category: "A", stampValue: 1 },
        { key: "spanish", name: "Spanish", category: "A", stampValue: 1 },
        { key: "urdu", name: "Urdu", category: "A", stampValue: 1 },
        { key: "arabic", name: "Arabic", category: "A", stampValue: 1 },
        { key: "russian", name: "Russian", category: "A", stampValue: 1 },
        {
            key: "postcard-writing",
            name: "Postcard Writing",
            category: "B",
            stampValue: 1,
        },
        // {
        //     key: "lounge-visit",
        //     name: "Lounge Visit",
        //     category: "C",
        //     stampValue: 3,
        // },
    ],

    REDEMPTION_TIERS: [
        {
            key: "tier1",
            name: "Tier 1",
            requiredStamps: 3,
            minCategories: 1,
            requireAllCategories: false,
            gifts: [{ name: "Pen", qty: 100 }],
        },
        {
            key: "tier2",
            name: "Tier 2",
            requiredStamps: 6,
            minCategories: 1,
            requireAllCategories: false,
            gifts: [
                { name: "Bookmark", qty: 100 },
                { name: "Keyboard Clicker", qty: 100 },
            ],
        },
        {
            key: "tier3",
            name: "Tier 3",
            requiredStamps: 9,
            minCategories: 1,
            requireAllCategories: false,
            gifts: [{ name: "Coin", qty: 100 }],
        },
    ],

    GROUPS: [
        { group_code: "BKRF75GY", quota: 40 },
        { group_code: "UHM6KVWD", quota: 30 },
        { group_code: "M5KTAHB7", quota: 10 },
        { group_code: "PMMP7E42", quota: 40 },
    ],

    RATE_LIMITS: {
        ENABLED: true,
        GENERAL: { windowMs: 60 * 1000, limit: 120 },
        REGISTRATION: { windowMs: 60 * 1000, limit: 20 },
        STAMP_ISSUE: { windowMs: 60 * 1000, limit: 20 },
        REDEMPTION: { windowMs: 60 * 1000, limit: 20 },
        ADMIN_LOGIN: { windowMs: 15 * 60 * 1000, limit: 10 },
        DEVELOPER_LOGIN: { windowMs: 15 * 60 * 1000, limit: 5 },
    },

    MAX_ROUNDS: 5,

    TOTAL_BOOTHS: 10,

    SESSION_TIMEOUT_MS: 8 * 60 * 60 * 1000,

    DB_POOL_MAX: 20,

    LOW_STOCK_THRESHOLD: 10,
};
