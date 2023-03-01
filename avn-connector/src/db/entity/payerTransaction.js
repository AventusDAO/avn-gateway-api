var EntitySchema = require("typeorm").EntitySchema

module.exports = new EntitySchema({
    name: "payerTransaction",
    columns: {
        transactionId: {
            primary: true,
            type: "int",
        },
        payerId: {
            primary: true,
            type: "int",
        },
        createdAt: {
            type: "timestamptz",
            createDate: true,
        },
        updatedAt: {
            type: "timestamptz",
            updateDate: true,
        },
        enabled: {
            type: "boolean",
            default: true,
        }
    },
    relations: {
        transaction: {
            target: 'transaction',
            primary: true,
            type: 'many-to-one',
            inverseSide: 'payerTransaction',
            joinTable: true,
            eager: false,
        },
        payer: {
            target: 'payer',
            primary: true,
            type: 'many-to-one',
            inverseSide: 'payerTransaction',
            joinTable: true,
            eager: false,
        }
    }
 })
