import { MigrationInterface, QueryRunner } from "typeorm";

export class multiCurrency1726749398777 implements MigrationInterface {
    name = 'multiCurrency1726749398777'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currency" ADD "name" character varying NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currency" DROP COLUMN "name"`);
    }

}
