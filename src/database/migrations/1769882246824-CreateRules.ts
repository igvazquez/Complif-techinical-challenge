import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRules1769882246824 implements MigrationInterface {
  name = 'CreateRules1769882246824';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "id_organization" uuid NOT NULL,
        "id_template" uuid,
        "name" character varying(255) NOT NULL,
        "description" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 0,
        "config" jsonb NOT NULL DEFAULT '{}',
        "created_by" character varying(255),
        CONSTRAINT "PK_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rules_template" FOREIGN KEY ("id_template") REFERENCES "rule_templates"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rules_id_organization" ON "rules" ("id_organization")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rules_id_template" ON "rules" ("id_template")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rules_id_organization_priority" ON "rules" ("id_organization", "priority")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rules_id_organization_enabled" ON "rules" ("id_organization", "enabled")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_rules_id_organization_enabled"`);
    await queryRunner.query(`DROP INDEX "idx_rules_id_organization_priority"`);
    await queryRunner.query(`DROP INDEX "idx_rules_id_template"`);
    await queryRunner.query(`DROP INDEX "idx_rules_id_organization"`);
    await queryRunner.query(`DROP TABLE "rules"`);
  }
}
