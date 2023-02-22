const { OneToOne, Entity } = require("typeorm")

var EntitySchema = require("typeorm").EntitySchema

module.exports = new EntitySchema({
    name: "splitFeeUser",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        payerId: {
            type: "int",
        },
        publicKey: {
            type: "varchar",
            unique: true,
            length: 66
        },
        description: {
            type: "varchar",
            nullable: true,
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
        payer: {
            target: 'payer',
            type: 'many-to-one',
            inverseSide: 'splitFeeUser',
            joinTable: true,
            eager: false,
        }
    }
 })
