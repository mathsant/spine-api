module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('shelf_memberships');
    // One want-to-read mark per user/book — marking twice is a no-op (RF-005).
    await db
      .collection('shelf_memberships')
      .createIndex(
        { userId: 1, bookId: 1 },
        { unique: true, name: 'shelf_memberships_userId_bookId_unique' },
      );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('shelf_memberships').drop();
  },
};
