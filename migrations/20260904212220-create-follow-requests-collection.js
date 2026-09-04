module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('follow_requests');
    // At most one pending request per ordered pair (RF-008).
    await db
      .collection('follow_requests')
      .createIndex(
        { requesterId: 1, targetId: 1 },
        { unique: true, name: 'follow_requests_requesterId_targetId_unique' },
      );
    // GET /v1/me/follow-requests?direction=incoming (D6).
    await db
      .collection('follow_requests')
      .createIndex({ targetId: 1, createdAt: -1 }, { name: 'follow_requests_targetId_createdAt' });
    // GET /v1/me/follow-requests?direction=outgoing (D6).
    await db
      .collection('follow_requests')
      .createIndex(
        { requesterId: 1, createdAt: -1 },
        { name: 'follow_requests_requesterId_createdAt' },
      );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('follow_requests').drop();
  },
};
