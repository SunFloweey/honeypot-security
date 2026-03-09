const crypto = require('crypto');

/**
 * TicketService - Generates short-lived, one-time-use security tickets.
 * Used to authorize SSE streams without exposes the long-lived Admin Token in URLs.
 */
class TicketService {
    constructor() {
        this.tickets = new Map();
        // Cleanup expired tickets every minute
        setInterval(() => this._cleanup(), 60000);
    }

    /**
     * Creates a new ticket valid for 30 seconds.
     */
    createTicket(metadata = {}) {
        const ticketId = crypto.randomBytes(24).toString('hex');
        const expiry = Date.now() + 30000; // 30 seconds to USE the ticket

        this.tickets.set(ticketId, {
            expiry,
            metadata
        });

        return ticketId;
    }

    /**
     * Validates and CONSUMES a ticket.
     * @returns {Object|null} The metadata associated with the ticket, or null if invalid.
     */
    validateTicket(ticketId) {
        if (!ticketId) return null;

        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        // Check expiry
        if (Date.now() > ticket.expiry) {
            this.tickets.delete(ticketId);
            return null;
        }

        // Consume (one-time use)
        const metadata = ticket.metadata;
        this.tickets.delete(ticketId);
        return metadata;
    }

    _cleanup() {
        const now = Date.now();
        for (const [id, ticket] of this.tickets.entries()) {
            if (now > ticket.expiry) {
                this.tickets.delete(id);
            }
        }
    }
}

module.exports = new TicketService();
