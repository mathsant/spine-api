module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('refresh_tokens');
    await db
      .collection('refresh_tokens')
      .createIndex({ tokenHash: 1 }, { unique: true, name: 'refresh_tokens_tokenHash_unique' });
    await db
      .collection('refresh_tokens')
      .createIndex({ sessionId: 1 }, { name: 'refresh_tokens_sessionId' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('refresh_tokens').drop();
  },
};
