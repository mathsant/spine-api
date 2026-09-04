module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('books');
    await db.collection('books').createIndex({ olid: 1 }, { unique: true, name: 'books_olid_unique' });
    // Not every Open Library result carries an ISBN-13, so the uniqueness is sparse.
    await db
      .collection('books')
      .createIndex({ isbn13: 1 }, { unique: true, sparse: true, name: 'books_isbn13_unique_sparse' });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('books').drop();
  },
};
