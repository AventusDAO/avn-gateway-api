var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'transaction',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    name: {
      type: 'varchar',
      unique: true
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
    payerTransactions: {
      target: 'payerTransaction',
      type: 'one-to-many',
      joinTable: true,
      inverseSide: 'transaction',
      cascade: true
    },
    fees: {
      target: 'fee',
      type: 'one-to-many',
      joinTable: true,
      inverseSide: 'transaction',
      cascade: true
    }
  }
});
