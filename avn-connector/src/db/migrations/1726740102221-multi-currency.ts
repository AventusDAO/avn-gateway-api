import { MigrationInterface, QueryRunner } from "typeorm";

export class multiCurrency1726740102221 implements MigrationInterface {
    name = 'multiCurrency1726740102221'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payer" DROP CONSTRAINT "FK_08b842580c013ebc4f51495a2ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_webhookEndpoint_updatedAt"`);
        await queryRunner.query(`CREATE TABLE "currency" ("currencyId" SERIAL NOT NULL, "token" character varying(42) NOT NULL, "native" boolean NOT NULL DEFAULT false, "enabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f138510174ee98185ec5d98d783" UNIQUE ("token"), CONSTRAINT "PK_d3752dab49b2453a76fa1c84d53" PRIMARY KEY ("currencyId"))`);
        await queryRunner.query(`CREATE TABLE "default_relayer_fee" ("id" SERIAL NOT NULL, "relayerId" integer NOT NULL, "currencyId" integer NOT NULL, "fee" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "currencyCurrencyId" integer, CONSTRAINT "UQ_bfcb25c2846f612d256a1d891e2" UNIQUE ("relayerId", "currencyId"), CONSTRAINT "PK_441abea96582ed01aa832a5fd63" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "relayer" DROP COLUMN "defaultFee"`);
        await queryRunner.query(`ALTER TABLE "fee" ADD "currencyId" integer`);
        await queryRunner.query(`ALTER TABLE "fee" ADD "currencyCurrencyId" integer`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD "currencyId" integer`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "PK_b5c821b1ee30f0c3da11f6abe6c"`);
        //await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "PK_5e0e58d0d7ae267ff4696924f6a" PRIMARY KEY ("transactionId", "payerId", "currencyId")`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD "currencyCurrencyId" integer`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "UQ_a6f588f77a9624084f58f901802" UNIQUE ("relayerId", "currencyId", "transactionId", "userPublicKey")`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" ADD CONSTRAINT "FK_e29aea4e6e6ba2dcd3a85c19ed4" FOREIGN KEY ("relayerId") REFERENCES "relayer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" ADD CONSTRAINT "FK_2b0bca52d184db979742a215404" FOREIGN KEY ("currencyCurrencyId") REFERENCES "currency"("currencyId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "FK_920f457b38138e993fac8bdd8f1" FOREIGN KEY ("currencyCurrencyId") REFERENCES "currency"("currencyId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "FK_a2f7ea90fe25ca5547f89a4652a" FOREIGN KEY ("currencyCurrencyId") REFERENCES "currency"("currencyId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payer" ADD CONSTRAINT "FK_08b842580c013ebc4f51495a2ce" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoint"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payer" DROP CONSTRAINT "FK_08b842580c013ebc4f51495a2ce"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "FK_a2f7ea90fe25ca5547f89a4652a"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "FK_920f457b38138e993fac8bdd8f1"`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" DROP CONSTRAINT "FK_2b0bca52d184db979742a215404"`);
        await queryRunner.query(`ALTER TABLE "default_relayer_fee" DROP CONSTRAINT "FK_e29aea4e6e6ba2dcd3a85c19ed4"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "UQ_a6f588f77a9624084f58f901802"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP COLUMN "currencyCurrencyId"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "PK_5e0e58d0d7ae267ff4696924f6a"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "PK_b5c821b1ee30f0c3da11f6abe6c" PRIMARY KEY ("transactionId", "payerId")`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP COLUMN "currencyId"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP COLUMN "currencyCurrencyId"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP COLUMN "currencyId"`);
        await queryRunner.query(`ALTER TABLE "relayer" ADD "defaultFee" character varying NOT NULL`);
        await queryRunner.query(`DROP TABLE "default_relayer_fee"`);
        await queryRunner.query(`DROP TABLE "currency"`);
        await queryRunner.query(`CREATE INDEX "IDX_webhookEndpoint_updatedAt" ON "webhook_endpoint" ("updatedAt") `);
        await queryRunner.query(`ALTER TABLE "payer" ADD CONSTRAINT "FK_08b842580c013ebc4f51495a2ce" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoint"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
