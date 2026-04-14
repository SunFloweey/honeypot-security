/**
 * Log Processing Web Worker
 * Offloads heavy log parsing, filtering, and sorting from the main UI thread.
 */

self.onmessage = (event) => {
    const { type, payload } = event.data;

    try {
        if (type === 'PROCESS_LOGS') {
            const { logs, riskFilter, ipFilter, fingerprintFilter } = payload;

            // 1. Filter logs (Off-thread)
            const filtered = logs.filter(log => {
                const matchesRisk = log.riskScore >= (riskFilter || 0);
                const matchesIP = !ipFilter || log.ipAddress === ipFilter || log.ip === ipFilter;
                const matchesFP = !fingerprintFilter || log.fingerprint === fingerprintFilter;

                return matchesRisk && matchesIP && matchesFP;
            });

            // 2. Sort by timestamp (DESC by default)
            filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            self.postMessage({
                type: 'LOGS_PROCESSED',
                payload: {
                    logs: filtered,
                    count: filtered.length
                }
            });
        }
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            payload: error.message
        });
    }
};
