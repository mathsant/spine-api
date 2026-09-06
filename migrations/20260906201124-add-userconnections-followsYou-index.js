module.exports = {
  /**
   * Supporting index for feature 011-userconnectionscontractgaps.
   *
   * @param db {import('mongodb').Db}
   * @returns {Promise<void>}
   */
  async up(db) {
    // Batch `followsYou` resolution for GET /users/:userId and the list DTOs
    // (UserSearchResult / FollowedUser / FollowRequestItem): the query is
    // { followeeId: <me>, followerId: { $in: [...] } }. Symmetric to the existing
    // forward unique index follows_followerId_followeeId_unique; not unique here.
    await db
      .collection('follows')
      .createIndex(
        { followeeId: 1, followerId: 1 },
        { name: 'follows_followeeId_followerId' },
      );
  },

  /**
   * @param db {import('mongodb').Db}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('follows').dropIndex('follows_followeeId_followerId');
  },
};
