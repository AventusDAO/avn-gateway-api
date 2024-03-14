var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'webhookEvent',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    type: {
      type: 'varchar',
      unique: true
    },
    description: {
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
  },
  relations: {
    payerWebhooks: {
      target: 'payerWebhooks',
      type: 'one-to-many',
      inverseSide: 'webhookEvent'
    }
  }
});
