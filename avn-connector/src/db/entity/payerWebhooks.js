var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'payerWebhooks',
  columns: {
    webhookEndpointId: {
      type: 'int',
      primary: true
    },
    webhookEventId: {
      type: 'int',
      primary: true
    },
    updatedAt: {
      type: 'timestamptz',
      updateDate: true
    }
  },
  indices: [
    {
      name: 'IDX_payerWebhooks_updatedAt',
      columns: ['updatedAt']
    }
  ],
  relations: {
    endpoint: {
      target: 'webhookEndpoint',
      type: 'many-to-one',
      joinColumn: { name: 'webhookEndpointId', referencedColumnName: 'id' },
      inverseSide: 'payerWebhooks',
      onDelete: 'CASCADE'
    },
    webhookEvent: {
      target: 'webhookEvent',
      type: 'many-to-one',
      joinColumn: { name: 'webhookEventId', referencedColumnName: 'id' },
      cascade: true
    }
  }
});
