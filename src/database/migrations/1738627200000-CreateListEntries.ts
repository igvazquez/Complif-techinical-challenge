import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateListEntries1738627200000 implements MigrationInterface {
  name = 'CreateListEntries1738627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "list_type_enum" AS ENUM ('BLACKLIST', 'WHITELIST')
    `);

    await queryRunner.query(`
      CREATE TYPE "entity_type_enum" AS ENUM ('ACCOUNT', 'IP', 'COUNTRY', 'DEVICE', 'EMAIL', 'PHONE')
    `);

    // Create list_entries table
    await queryRunner.query(`
      CREATE TABLE "list_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "id_organization" uuid NOT NULL,
        "list_type" "list_type_enum" NOT NULL,
        "entity_type" "entity_type_enum" NOT NULL,
        "entity_value" character varying(255) NOT NULL,
        "reason" text,
        "expires_at" TIMESTAMP,
        "created_by" uuid,
        CONSTRAINT "PK_list_entries" PRIMARY KEY ("id")
      )
    `);

    // Organization index (required for tenant queries)
    await queryRunner.query(`
      CREATE INDEX "idx_list_entries_id_organization" ON "list_entries" ("id_organization")
    `);

    // Composite index for list lookups
    await queryRunner.query(`
      CREATE INDEX "idx_list_entries_org_type" ON "list_entries" ("id_organization", "list_type", "entity_type")
    `);

    // Index for expiration cleanup
    await queryRunner.query(`
      CREATE INDEX "idx_list_entries_expires" ON "list_entries" ("expires_at") WHERE "expires_at" IS NOT NULL
    `);

    // Unique constraint prevents duplicate entries
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_list_entries_org_list_entity" ON "list_entries" ("id_organization", "list_type", "entity_type", "entity_value")
    `);

    // Foreign key constraint to organizations
    await queryRunner.query(`
      ALTER TABLE "list_entries"
      ADD CONSTRAINT "FK_list_entries_organization" FOREIGN KEY ("id_organization")
      REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "list_entries" DROP CONSTRAINT "FK_list_entries_organization"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "uq_list_entries_org_list_entity"`);
    await queryRunner.query(`DROP INDEX "idx_list_entries_expires"`);
    await queryRunner.query(`DROP INDEX "idx_list_entries_org_type"`);
    await queryRunner.query(`DROP INDEX "idx_list_entries_id_organization"`);

    // Drop table
    await queryRunner.query(`DROP TABLE "list_entries"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "entity_type_enum"`);
    await queryRunner.query(`DROP TYPE "list_type_enum"`);
  }
}
