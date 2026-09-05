module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('comments');
    // listByActivity: cursor page ordered ascending by createdAt/_id (007, D5 of research.md).
    await db
      .collection('comments')
      .createIndex({ activityId: 1, createdAt: 1, _id: 1 }, { name: 'comments_activityId_createdAt' });
    // Cascade deletes from delete-reading-session / delete-review (007, D3 of research.md).
    await db
      .collection('comments')
      .createIndex({ readingSessionId: 1, activityType: 1 }, { name: 'comments_readingSessionId_activityType' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('comments').drop();
  },
};
