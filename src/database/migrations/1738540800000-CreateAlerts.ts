import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlerts1738540800000 implements MigrationInterface {
  name = 'CreateAlerts1738540800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "alert_severity_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    `);

    await queryRunner.query(`
      CREATE TYPE "alert_category_enum" AS ENUM ('AML', 'FRAUD', 'COMPLIANCE', 'UNKNOWN')
    `);

    await queryRunner.query(`
      CREATE TYPE "alert_status_enum" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE')
    `);

    // Create alerts table
    await queryRunner.query(`
      CREATE TABLE "alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "id_organization" uuid NOT NULL,
        "id_rule" uuid NOT NULL,
        "id_transaction" uuid NOT NULL,
        "id_account" character varying(255),
        "severity" "alert_severity_enum" NOT NULL DEFAULT 'MEDIUM',
        "category" "alert_category_enum" NOT NULL DEFAULT 'UNKNOWN',
        "status" "alert_status_enum" NOT NULL DEFAULT 'OPEN',
        "hit_count" integer NOT NULL DEFAULT 1,
        "first_triggered_at" TIMESTAMP NOT NULL,
        "last_triggered_at" TIMESTAMP NOT NULL,
        "dedup_key" character varying(512) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_alerts" PRIMARY KEY ("id")
      )
    `);

    // Organization index (required for tenant queries)
    await queryRunner.query(`
      CREATE INDEX "idx_alerts_id_organization" ON "alerts" ("id_organization")
    `);

    // Status filtering within organization
    await queryRunner.query(`
      CREATE INDEX "idx_alerts_org_status" ON "alerts" ("id_organization", "status")
    `);

    // Severity filtering within organization
    await queryRunner.query(`
      CREATE INDEX "idx_alerts_org_severity" ON "alerts" ("id_organization", "severity")
    `);

    // Category filtering within organization
    await queryRunner.query(`
      CREATE INDEX "idx_alerts_org_category" ON "alerts" ("id_organization", "category")
    `);

    // Rule-based filtering within organization
    await queryRunner.query(`
      CREATE INDEX "idx_alerts_org_rule" ON "alerts" ("id_organization", "id_rule")
    `);

    // Deduplication key lookup (critical for upsert)
    await queryRunner.query(`
      CREATE INDEX "idx_alerts_dedup_key" ON "alerts" ("dedup_key")
    `);

    // Rule foreign key index
    await queryRunner.query(`
      CREATE INDEX "idx_alerts_id_rule" ON "alerts" ("id_rule")
    `);

    // Foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "alerts"
      ADD CONSTRAINT "FK_alerts_rule" FOREIGN KEY ("id_rule")
      REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "alerts"
      ADD CONSTRAINT "FK_alerts_transaction" FOREIGN KEY ("id_transaction")
      REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_alerts_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_alerts_rule"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_alerts_id_rule"`);
    await queryRunner.query(`DROP INDEX "idx_alerts_dedup_key"`);
    await queryRunner.query(`DROP INDEX "idx_alerts_org_rule"`);
    await queryRunner.query(`DROP INDEX "idx_alerts_org_category"`);
    await queryRunner.query(`DROP INDEX "idx_alerts_org_severity"`);
    await queryRunner.query(`DROP INDEX "idx_alerts_org_status"`);
    await queryRunner.query(`DROP INDEX "idx_alerts_id_organization"`);

    // Drop table
    await queryRunner.query(`DROP TABLE "alerts"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "alert_status_enum"`);
    await queryRunner.query(`DROP TYPE "alert_category_enum"`);
    await queryRunner.query(`DROP TYPE "alert_severity_enum"`);
  }
}
