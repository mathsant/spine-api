module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    // Supports GET /v1/users/search (RF-004, D2 of research.md).
    await db
      .collection('users')
      .createIndex(
        { displayName: 'text', handle: 'text' },
        { name: 'users_displayName_handle_text' },
      );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('users').dropIndex('users_displayName_handle_text');
  },
};
