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
      unique: true,
      nullable: false
    },
    description: {
      type: 'varchar',
      unique: true,
      nullable: false
    },
    createdAt: {
      type: 'timestamptz',
      createDate: true
    },
    updatedAt: {
      type: 'timestamptz',
      updateDate: true
    },
    enabled: {
      type: 'boolean',
      default: true
    }
  },
  relations: {
    webhooks: {
      target: 'webhooks',
      type: 'one-to-many',
      inverseSide: 'webhookEvent'
    }
  }
});
