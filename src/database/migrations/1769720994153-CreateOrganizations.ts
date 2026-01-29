import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizations1769720994153 implements MigrationInterface {
  name = 'CreateOrganizations1769720994153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "settings" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_organizations_name" ON "organizations" ("name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_organizations_name"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}
