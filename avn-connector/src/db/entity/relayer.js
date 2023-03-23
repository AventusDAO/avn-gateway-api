var EntitySchema = require('typeorm').EntitySchema;

module.exports = new EntitySchema({
  name: 'relayer',
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
    defaultFee: {
      type: 'varchar'
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
    fees: {
      target: 'fee',
      type: 'one-to-many',
      joinTable: true,
      inverseSide: 'relayer',
      cascade: true
    }
  }
});
