var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'payerWebhookEvents',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    endpointId: {
      type: 'int'
    },
    webhookEventId: {
      type: 'int'
    },
    updatedAt: {
      type: 'timestamptz',
      updateDate: true
    }
  },
  uniques: [
    {
      name: 'UQ_endpointId_webhookEventId',
      columns: ['endpointId', 'webhookEventId']
    }
  ],
  indices: [
    {
      name: 'IDX_payerWebhookEvents_updatedAt',
      columns: ['updatedAt']
    }
  ],
  relations: {
    endpoint: {
      target: 'payerWebhookEndpoints',
      type: 'many-to-one',
      joinColumn: { name: 'endpointId', referencedColumnName: 'id' },
      inverseSide: 'payerWebhookEvents',
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
