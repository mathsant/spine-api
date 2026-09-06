module.exports = {
  /**
   * Supporting indexes for feature 010-readingcontractgaps.
   *
   * @param db {import('mongodb').Db}
   * @returns {Promise<void>}
   */
  async up(db) {
    // New history ordering of GET /me/reading-sessions: reading before finished,
    // then createdAt desc (sort({ status: -1, createdAt: -1, _id: -1 })).
    await db
      .collection('reading_sessions')
      .createIndex(
        { userId: 1, status: -1, createdAt: -1 },
        { name: 'reading_sessions_userId_status_createdAt' },
      );
    // findLatestFinishedPerUserForBook (GET /books/:olid/reviews) and the
    // popular-among-following aggregation both match on { bookId, status, userId }.
    await db
      .collection('reading_sessions')
      .createIndex(
        { bookId: 1, status: 1, userId: 1 },
        { name: 'reading_sessions_bookId_status_userId' },
      );
    // Batch lookup of a book's reviews restricted to a set of followed users.
    await db
      .collection('reviews')
      .createIndex({ bookId: 1, userId: 1 }, { name: 'reviews_bookId_userId' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('reading_sessions').dropIndex('reading_sessions_userId_status_createdAt');
    await db.collection('reading_sessions').dropIndex('reading_sessions_bookId_status_userId');
    await db.collection('reviews').dropIndex('reviews_bookId_userId');
  },
};
