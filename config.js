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
            requiredStamps: 2,
            minCategories: 1,
            requireAllCategories: false,
            gifts: [{ name: "Pen", qty: 1000 }],
        },
        {
            key: "tier2",
            name: "Tier 2",
            requiredStamps: 4,
            minCategories: 1,
            requireAllCategories: false,
            gifts: [
                { name: "Bookmark", qty: 500 },
                { name: "Keyboard Clicker", qty: 500 },
            ],
        },
        {
            key: "tier3",
            name: "Tier 3",
            requiredStamps: 6,
            minCategories: 1,
            requireAllCategories: false,
            gifts: [{ name: "Coin", qty: 1000 }],
        },
    ],

    // GROUPS: [
    //     { group_code: "6V8GL2P4", quota: 18 },
    //     { group_code: "E9ZBRATM", quota: 10 },
    //     { group_code: "Q78VQMQP", quota: 2 },
    //     { group_code: "XHSR1EF8", quota: 20 },
    //     { group_code: "97G65AQJ", quota: 5 },
    //     { group_code: "HX5HSNHD", quota: 100 },
    //     { group_code: "9DRYH7ON", quota: 100 }, //guest
    //     { group_code: "LLR4LM84", quota: 100 }, //Amb Sch
    //     { group_code: "GC307EER", quota: 100 }, //Amb Sch
    //     { group_code: "TIWYVYUN", quota: 100 }, //Amb Sch
    //     { group_code: "5BUJ2NMR", quota: 100 }, //Amb Sch
    //     { group_code: "GX756FCB", quota: 100 }, //Amb Sch
    //     { group_code: "VIMF99F8", quota: 100 }, //Amb Sch
    //     { group_code: "ZQYQYX45", quota: 100 }, //Amb Sch
    //     { group_code: "V595O25O", quota: 100 }, //Amb Sch
    //     { group_code: "7C8NEBQR", quota: 100 }, //Amb Sch
    //     { group_code: "SVFCRNQH", quota: 100 }, //Amb Sch
    //     { group_code: "VPPMGUDA", quota: 100 }, //Amb Sch
    //     { group_code: "ERSDHU6H", quota: 100 }, //Amb Sch
    //     { group_code: "FRYB263R", quota: 100 }, //Amb Sch
    //     { group_code: "GGOL7ZTJ", quota: 100 }, //Amb Sch
    // ],

    GROUPS: [
        { group_code: "6V8GL2P4", quota: 20 },
        { group_code: "E9ZBRATM", quota: 20 },
        { group_code: "Q78VQMQP", quota: 10 },
        { group_code: "XHSR1EF8", quota: 30 },
        { group_code: "97G65AQJ", quota: 10 },
        { group_code: "HX5HSNHD", quota: 10 },
        { group_code: "9DRYH7ON", quota: 50 }, //guest
        { group_code: "LLR4LM84", quota: 20 }, //Amb Sch
        { group_code: "GC307EER", quota: 20 }, //Amb Sch
        { group_code: "TIWYVYUN", quota: 20 }, //Amb Sch
        { group_code: "5BUJ2NMR", quota: 20 }, //Amb Sch
        { group_code: "GX756FCB", quota: 20 }, //Amb Sch
        { group_code: "VIMF99F8", quota: 20 }, //Amb Sch
        { group_code: "ZQYQYX45", quota: 20 }, //Amb Sch
        { group_code: "V595O25O", quota: 20 }, //Amb Sch
        { group_code: "7C8NEBQR", quota: 20 }, //Amb Sch
        { group_code: "SVFCRNQH", quota: 20 }, //Amb Sch
        { group_code: "VPPMGUDA", quota: 20 }, //Amb Sch
        { group_code: "ERSDHU6H", quota: 20 }, //Amb Sch
        { group_code: "FRYB263R", quota: 20 }, //Amb Sch
        { group_code: "GGOL7ZTJ", quota: 20 }, //Amb Sch
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
