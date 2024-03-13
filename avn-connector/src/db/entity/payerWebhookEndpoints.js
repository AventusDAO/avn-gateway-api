var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'payerWebhookEndpoints',
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
      type: 'varchar',
      nullable: false
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
      name: 'IDX_payerWebhookEndpoints_updatedAt',
      columns: ['updatedAt']
    }
  ],
  relations: {
    payer: {
      target: 'payer',
      type: 'many-to-one',
      joinColumn: { name: 'payerId', referencedColumnName: 'id' },
      inverseSide: 'payerWebhookEndpoints',
      cascade: true
    }
  }
});
