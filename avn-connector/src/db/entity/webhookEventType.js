var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'webhookEventType',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    eventType: {
      type: 'varchar',
      unique: true
    },
    eventDescription: {
      type: 'varchar',
      unique: true
    },
    createdAt: {
      type: 'timestamptz',
      createDate: true
    },
    updatedAt: {
      type: 'timestamptz',
      updateDate: true
    }
  }
});
