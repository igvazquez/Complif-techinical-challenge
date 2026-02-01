import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTemplateOverrides1769882137084 implements MigrationInterface {
  name = 'CreateTemplateOverrides1769882137084';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "template_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "id_organization" uuid NOT NULL,
        "id_template" uuid NOT NULL,
        "overrides" jsonb NOT NULL DEFAULT '{}',
        "enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_template_overrides_org_template" UNIQUE ("id_organization", "id_template"),
        CONSTRAINT "PK_template_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "FK_template_overrides_template" FOREIGN KEY ("id_template") REFERENCES "rule_templates"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_template_overrides_id_organization" ON "template_overrides" ("id_organization")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_template_overrides_id_template" ON "template_overrides" ("id_template")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_template_overrides_id_template"`);
    await queryRunner.query(
      `DROP INDEX "idx_template_overrides_id_organization"`,
    );
    await queryRunner.query(`DROP TABLE "template_overrides"`);
  }
}
