import { MigrationInterface, QueryRunner } from "typeorm";

export class multiCurrency31726749398507 implements MigrationInterface {
    name = 'multiCurrency31726749398507'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "PK_5e0e58d0d7ae267ff4696924f6a" PRIMARY KEY ("transactionId", "payerId", "currencyId")`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "FK_4d28f6d5f2558ebf9535bbd96ca"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "UQ_a6f588f77a9624084f58f901802"`);
        await queryRunner.query(`ALTER TABLE "fee" ALTER COLUMN "currencyId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "FK_8444ee59f786ff114e38537ddb1"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ALTER COLUMN "currencyId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "UQ_a6f588f77a9624084f58f901802" UNIQUE ("relayerId", "currencyId", "transactionId", "userPublicKey")`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "FK_4d28f6d5f2558ebf9535bbd96ca" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "FK_8444ee59f786ff114e38537ddb1" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "PK_5e0e58d0d7ae267ff4696924f6a"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" DROP CONSTRAINT "FK_8444ee59f786ff114e38537ddb1"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "FK_4d28f6d5f2558ebf9535bbd96ca"`);
        await queryRunner.query(`ALTER TABLE "fee" DROP CONSTRAINT "UQ_a6f588f77a9624084f58f901802"`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ALTER COLUMN "currencyId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payer_transaction" ADD CONSTRAINT "FK_8444ee59f786ff114e38537ddb1" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fee" ALTER COLUMN "currencyId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "UQ_a6f588f77a9624084f58f901802" UNIQUE ("relayerId", "transactionId", "userPublicKey", "currencyId")`);
        await queryRunner.query(`ALTER TABLE "fee" ADD CONSTRAINT "FK_4d28f6d5f2558ebf9535bbd96ca" FOREIGN KEY ("currencyId") REFERENCES "currency"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
