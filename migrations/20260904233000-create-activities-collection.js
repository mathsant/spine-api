module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('activities');
    // Feed query: actorId $in [...] + sort/cursor by createdAt/_id (006, D7 of research.md).
    await db
      .collection('activities')
      .createIndex({ actorId: 1, createdAt: -1, _id: -1 }, { name: 'activities_actorId_createdAt' });
    // Cascade deletes from delete-reading-session / delete-review (006, D4 of research.md).
    await db
      .collection('activities')
      .createIndex({ readingSessionId: 1 }, { name: 'activities_readingSessionId' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('activities').drop();
  },
};
