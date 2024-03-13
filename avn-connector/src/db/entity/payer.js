var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'payer',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    publicKey: {
      type: 'varchar',
      unique: true,
      length: 66
    },
    cognitoId: {
      type: 'varchar',
      unique: true
    },
    vaultId: {
      type: 'uuid',
      generated: 'uuid'
    },
    description: {
      type: 'varchar',
      nullable: true
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
    payerWebhookEvents: {
      target: 'payerWebhookEvents',
      type: 'one-to-many',
      inverseSide: 'payer'
    },
    payerWebhookEndpoint: {
      target: 'payerWebhookEndpoint',
      type: 'one-to-one',
      inverseSide: 'payer',
      joinColumn: true
    },
    splitFeeUsers: {
      target: 'splitFeeUser',
      type: 'one-to-many',
      joinTable: true,
      inverseSide: 'payer',
      cascade: true
    }
  }
});
