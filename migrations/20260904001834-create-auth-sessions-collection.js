module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('auth_sessions');
    await db
      .collection('auth_sessions')
      .createIndex({ userId: 1 }, { name: 'auth_sessions_userId' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('auth_sessions').drop();
  },
};
