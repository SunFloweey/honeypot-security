/**
 * Global Configuration for the Honeypot Project
 * Centralizing branding and behavioral constants
 */

export const CONFIG = {
    // Decoy Identity (Corporate Persona)
    BRAND: {
        NAME: "Global Tech Solutions",
        SHORT_NAME: "G-Tech",
        LEGAL_NAME: "Global Tech Solutions Inc.",
        YEAR: 2026,
        LOGO_LETTER: "G",
        LOGO_IMAGE: "/vite.svg",
        SUPPORT_EMAIL: "soc-support@globaltech.com",
        SUPPORT_EXT: "ext. 4455"
    },

    // Technical Bait Details
    BAIT: {
        LEGACY_VERSION: "v1.2.0-legacy",
        DATABASE_VERSION: "v5.7.32",
        UPTIME: "99.98%",
        APACHE_VERSION: "Apache/2.4.41 (Ubuntu)",
        PORT: 80
    },

    // Timing Derivation (ms)
    TIMING: {
        STATS_UPDATE_MIN: 2000,
        STATS_UPDATE_MAX: 5000,
        UPLOAD_LATENCY_MIN: 1000,
        UPLOAD_LATENCY_MAX: 3000,
        POLLING_MIN: 4000,
        POLLING_MAX: 6000
    },
    // API Base URL
    // In Docker, we use relative paths so Nginx can proxy correctly.
    API_BASE_URL: import.meta.env.VITE_API_URL || "",
    HONEYPOT_URL: import.meta.env.VITE_HONEYPOT_URL || "",
    WS_URL: import.meta.env.VITE_WS_URL || window.location.origin,
};

export default CONFIG;
