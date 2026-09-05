module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db) {
    await db.createCollection('notifications');
    // listByRecipient: cursor page ordered descending by createdAt/_id — newest first (RF-011).
    await db
      .collection('notifications')
      .createIndex({ recipientId: 1, createdAt: -1, _id: -1 }, { name: 'notifications_recipientId_createdAt' });
    // countUnread / markAllRead, both filter readAt: null (RF-014, RF-016).
    await db
      .collection('notifications')
      .createIndex({ recipientId: 1, readAt: 1 }, { name: 'notifications_recipientId_readAt' });
    // Delete by key for follow_request / reaction_on_content (D2 of research.md).
    await db
      .collection('notifications')
      .createIndex(
        { recipientId: 1, actorId: 1, type: 1, activityId: 1 },
        { name: 'notifications_recipientId_actorId_type_activityId' },
      );
    // deleteByCommentId cascade (D6 of research.md); partial — only comment-related types set it.
    await db.collection('notifications').createIndex(
      { commentId: 1 },
      {
        name: 'notifications_commentId',
        partialFilterExpression: { commentId: { $type: 'string' } },
      },
    );
    // Cascade of delete-reading-session / delete-review (D5 of research.md); partial — only
    // activity-related types set it.
    await db.collection('notifications').createIndex(
      { readingSessionId: 1, activityType: 1 },
      {
        name: 'notifications_readingSessionId_activityType',
        partialFilterExpression: { readingSessionId: { $type: 'string' } },
      },
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db) {
    await db.collection('notifications').drop();
  },
};
