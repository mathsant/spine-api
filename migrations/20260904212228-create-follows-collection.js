module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('follows');
    // At most one approved relation per ordered pair (RF-007).
    await db
      .collection('follows')
      .createIndex(
        { followerId: 1, followeeId: 1 },
        { unique: true, name: 'follows_followerId_followeeId_unique' },
      );
    // GET /v1/me/followers (RF-018).
    await db
      .collection('follows')
      .createIndex({ followeeId: 1, createdAt: -1 }, { name: 'follows_followeeId_createdAt' });
    // GET /v1/me/following (RF-019).
    await db
      .collection('follows')
      .createIndex({ followerId: 1, createdAt: -1 }, { name: 'follows_followerId_createdAt' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('follows').drop();
  },
};
