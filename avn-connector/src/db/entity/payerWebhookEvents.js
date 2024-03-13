var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'payerWebhookEvents',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    payerId: {
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
      name: 'UQ_payerId_webhookEventId',
      columns: ['payerId', 'webhookEventId']
    }
  ],
  indices: [
    {
      name: 'IDX_updatedAt',
      columns: ['updatedAt']
    }
  ],
  relations: {
    payer: {
      target: 'payer',
      type: 'many-to-one',
      joinColumn: true,
      cascade: true,
      inverseSide: 'payerWebhookEvents'
    },
    webhookEvent: {
      target: 'webhookEvent',
      type: 'many-to-one',
      joinColumn: true,
      cascade: true,
      inverseSide: 'payerWebhookEvents'
    }
  }
});
