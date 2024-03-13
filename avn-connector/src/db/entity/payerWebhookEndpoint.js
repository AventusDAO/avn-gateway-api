var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'payerWebhookEndpoint',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    payerId: {
      type: 'int',
      unique: true
    },
    webhookEndpoint: {
      type: 'varchar'
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
      name: 'IDX_updatedAt',
      columns: ['updatedAt']
    }
  ],
  relations: {
    payer: {
      target: 'payer',
      type: 'one-to-one',
      joinColumn: true,
      cascade: true,
      inverseSide: 'payerWebhookEndpoint'
    }
  }
});
