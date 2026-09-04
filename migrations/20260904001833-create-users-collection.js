module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('users');
    // `email` and `handle` are stored already normalised (trim + lowercase), so a plain
    // unique index gives case-insensitive uniqueness without a collation.
    await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' });
    await db
      .collection('users')
      .createIndex({ handle: 1 }, { unique: true, name: 'users_handle_unique' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('users').drop();
  },
};
