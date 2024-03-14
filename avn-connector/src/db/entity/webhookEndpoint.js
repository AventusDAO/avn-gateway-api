var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'webhookEndpoint',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    endpoint: {
      type: 'varchar',
      nullable: false,
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
  indices: [
    {
      name: 'IDX_webhookEndpoint_updatedAt',
      columns: ['updatedAt']
    }
  ],
  relations: {
    payers: {
      target: 'payer',
      type: 'one-to-many',
      inverseSide: 'webhookEndpoint'
    },
    webhooks: {
       target: 'webhooks',
       type: 'one-to-many',
       inverseSide: 'webhookEndpoint',
     }
  }
});
