module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('reviews');
    // At most one review per reading session (RF-003).
    await db
      .collection('reviews')
      .createIndex({ sessionId: 1 }, { unique: true, name: 'reviews_sessionId_unique' });
    // GET /v1/books/:olid aggregates (averageRating/reviewCount — RF-009).
    await db.collection('reviews').createIndex({ bookId: 1 }, { name: 'reviews_bookId' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('reviews').drop();
  },
};
