module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('reactions');
    // Idempotent add() upsert + at most one reaction per (activity, user) — RF-002, D4 of research.md.
    await db
      .collection('reactions')
      .createIndex({ activityId: 1, userId: 1 }, { name: 'reactions_activityId_userId', unique: true });
    // Cascade deletes from delete-reading-session / delete-review (007, D3 of research.md).
    await db
      .collection('reactions')
      .createIndex({ readingSessionId: 1, activityType: 1 }, { name: 'reactions_readingSessionId_activityType' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('reactions').drop();
  },
};
