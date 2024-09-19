import { MigrationInterface, QueryRunner } from "typeorm";
const config = require('multiconfig').load();

export class multiCurrency21726747887371 implements MigrationInterface {
    name = 'multiCurrency21726747887371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const relayer = await queryRunner.query(`SELECT id, "defaultFee" FROM relayer ORDER BY created_at DESC LIMIT 1`);
        await queryRunner.query(`ALTER TABLE "payer" DROP CONSTRAINT "FK_08b842580c013ebc4f51495a2ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_webhookEndpoint_updatedAt"`);
        await queryRunner.query(`CREATE TABLE "currency" ("id" SERIAL NOT NULL, "token" character varying(42) NOT NULL, "native" boolean NOT NULL DEFAULT false, "enabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f138510174ee98185ec5d98d783" UNIQUE ("token"), CONSTRAINT "PK_3cda65c731a6264f0e444cc9b91" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "default_relayer_fee" ("id" SERIAL NOT NULL, "relayerId" integer NOT NULL, "currencyId" integer NOT NULL, "fee" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_bfcb25c2846f612d256a1d891e2" UNIQUE ("relayerId", "currencyId"), CONSTRAINT "PK_441abea96582ed01aa832a5fd63" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "relayer" DROP COLUMN "defaultFee"`);
        await queryRunner.query(`ALTER TABLE "fee" ADD "currencyId" integer`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD "currencyId" integer`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "PK_b5c821b1ee30f0c3da11f6abe6c"`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "UQ_a6f588f77a9624084f58f901802" UNIQUE ("relayerId", "currencyId", "transactionId", "userPublicKey")`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" ADD CONSTRAINT "FK_e29aea4e6e6ba2dcd3a85c19ed4" FOREIGN KEY ("relayerId") REFERENCES "relayer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" ADD CONSTRAINT "FK_92f6264aa89912fccbbdec93f3b" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "FK_4d28f6d5f2558ebf9535bbd96ca" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "FK_8444ee59f786ff114e38537ddb1" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payer" ADD CONSTRAINT "FK_08b842580c013ebc4f51495a2ce" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoint"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        const currency = await queryRunner.query(`INSERT INTO currency (token, native) VALUES ('${config.postgres.nativeTokenAddress}', true) RETURNING id`);
        await queryRunner.query(`INSERT INTO default_relayer_fee ("relayerId", "currencyId", fee) VALUES (${relayer[0].id}, ${currency[0].id}, ${relayer[0].defaultFee})`);
        await queryRunner.query(`INSERT fee SET "currencyId" = ${currency[0].id}`);
        await queryRunner.query(`INSERT payer_transaction SET "currencyId" = ${currency[0].id}`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "PK_5e0e58d0d7ae267ff4696924f6a" PRIMARY KEY ("transactionId", "payerId", "currencyId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payer" DROP CONSTRAINT "FK_08b842580c013ebc4f51495a2ce"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "FK_8444ee59f786ff114e38537ddb1"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "FK_4d28f6d5f2558ebf9535bbd96ca"`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" DROP CONSTRAINT "FK_92f6264aa89912fccbbdec93f3b"`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" DROP CONSTRAINT "FK_e29aea4e6e6ba2dcd3a85c19ed4"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "UQ_a6f588f77a9624084f58f901802"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "PK_5e0e58d0d7ae267ff4696924f6a"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "PK_b5c821b1ee30f0c3da11f6abe6c" PRIMARY KEY ("transactionId", "payerId")`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP COLUMN "currencyId"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP COLUMN "currencyId"`);
        await queryRunner.query(`ALTER TABLE "relayer" ADD "defaultFee" character varying`);
        await queryRunner.query(`DROP TABLE "default_relayer_fee"`);
        await queryRunner.query(`DROP TABLE "currency"`);
        await queryRunner.query(`CREATE INDEX "IDX_webhookEndpoint_updatedAt" ON "webhook_endpoint" ("updatedAt") `);
        await queryRunner.query(`ALTER TABLE "payer" ADD CONSTRAINT "FK_08b842580c013ebc4f51495a2ce" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoint"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
