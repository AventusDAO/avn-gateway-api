var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'fee',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    relayerId: {
      type: 'int'
    },
    transactionId: {
      type: 'int',
      nullable: true
    },
    userPublicKey: {
      type: 'varchar',
      length: 66,
      nullable: true
    },
    fee: {
      type: 'varchar'
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
    relayer: {
      target: 'relayer',
      type: 'many-to-one',
      joinTable: true,
      inverseSide: 'fee',
      eager: true
    },
    transaction: {
      target: 'transaction',
      type: 'many-to-one',
      joinTable: true,
      inverseSide: 'fee',
      eager: true,
      nullable: true
    }
  }
});
