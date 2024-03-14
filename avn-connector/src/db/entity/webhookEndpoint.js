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
      name: 'IDX_webhookEndpoint_updatedAt',
      columns: ['updatedAt']
    }
  ],
  relations: {
    payer: {
      target: 'payer',
      type: 'one-to-one',
      inverseSide: 'webhookEndpoint',
      joinColumn: { name: 'webhookEndpointId', referencedColumnName: 'id' },
      nullable: true
    }
  }
});
