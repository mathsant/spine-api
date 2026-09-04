module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('reading_sessions');
    // At most one open ("reading") session per user/book — enforced at the database
    // level so a race between two "start reading" requests can't create a duplicate.
    await db.collection('reading_sessions').createIndex(
      { userId: 1, bookId: 1 },
      {
        unique: true,
        partialFilterExpression: { status: 'reading' },
        name: 'reading_sessions_open_unique',
      },
    );
    // History pagination (cursor by createdAt desc).
    await db
      .collection('reading_sessions')
      .createIndex({ userId: 1, createdAt: -1 }, { name: 'reading_sessions_userId_createdAt' });
    // Filter history by book.
    await db
      .collection('reading_sessions')
      .createIndex({ userId: 1, bookId: 1 }, { name: 'reading_sessions_userId_bookId' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('reading_sessions').drop();
  },
};
