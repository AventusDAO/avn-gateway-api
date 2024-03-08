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
    },
    webhookEndpoint: {
      type: 'varchar',
      nullable: true
    },
    webhookEventTypes: {
      type: 'text',
      array: true,
      nullable: true
    }
  },
  relations: {
    splitFeeUsers: {
      target: 'splitFeeUser',
      type: 'one-to-many',
      joinTable: true,
      inverseSide: 'payer',
      cascade: true
    }
  }
});
