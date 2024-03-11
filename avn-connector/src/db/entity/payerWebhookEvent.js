var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'payerWebhookEvent',
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
    }
  },
  relations: {
    payer: {
      target: 'payer',
      type: 'many-to-one',
      joinColumn: true,
      cascade: true,
      inverseSide: 'payerWebhookEvent'
    },
    webhookEvent: {
      target: 'webhookEvent',
      type: 'many-to-one',
      joinColumn: true,
      cascade: true,
      inverseSide: 'payerWebhookEvent'
    }
  }
});
