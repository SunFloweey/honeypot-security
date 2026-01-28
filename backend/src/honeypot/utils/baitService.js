/**
 * BaitService - Centralizes generation and management of fake decoy data.
 */
class BaitService {
    constructor() {
        this.fakeUsers = this.generateUsers(50);
        this.fakePosts = this.generatePosts(30);
    }

    /**
     * Generate a list of fake users
     */
    generateUsers(count) {
        return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            username: `user${i + 1}`,
            email: `user${i + 1}@example.com`,
            firstName: ['John', 'Jane', 'Bob', 'Alice', 'Charlie'][i % 5],
            lastName: ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown'][i % 5],
            role: i < 3 ? 'admin' : 'user',
            createdAt: new Date(2024, 0, i + 1).toISOString()
        }));
    }

    /**
     * Generate a list of fake posts
     */
    generatePosts(count) {
        return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            title: `Post Title ${i + 1}`,
            content: `This is the content of post ${i + 1}. Lorem ipsum dolor sit amet.`,
            authorId: (i % 10) + 1,
            published: i % 3 === 0,
            createdAt: new Date(2024, i % 12, 1).toISOString()
        }));
    }

    /**
     * Public getters for external usage
     */
    getUsers() {
        return [...this.fakeUsers];
    }

    getPosts() {
        return [...this.fakePosts];
    }

    getUserById(id) {
        return this.fakeUsers.find(u => u.id === parseInt(id));
    }
}

// Export singleton
module.exports = new BaitService();
