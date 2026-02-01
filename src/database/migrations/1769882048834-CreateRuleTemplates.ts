import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRuleTemplates1769882048834 implements MigrationInterface {
  name = 'CreateRuleTemplates1769882048834';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rule_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "config" jsonb NOT NULL DEFAULT '{}',
        "is_default" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_rule_templates_name" UNIQUE ("name"),
        CONSTRAINT "PK_rule_templates" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rule_templates_name" ON "rule_templates" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rule_templates_is_default" ON "rule_templates" ("is_default")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_rule_templates_is_default"`);
    await queryRunner.query(`DROP INDEX "idx_rule_templates_name"`);
    await queryRunner.query(`DROP TABLE "rule_templates"`);
  }
}
