import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransactions1769900000000 implements MigrationInterface {
  name = 'CreateTransactions1769900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "id_organization" uuid NOT NULL,
        "id_account" character varying(255) NOT NULL,
        "amount" numeric(18, 4) NOT NULL,
        "amount_normalized" numeric(18, 4) NOT NULL,
        "currency" character varying(10) NOT NULL,
        "type" character varying(50) NOT NULL,
        "sub_type" character varying(50),
        "datetime" TIMESTAMP NOT NULL,
        "date" date NOT NULL,
        "is_voided" boolean NOT NULL DEFAULT false,
        "is_blocked" boolean NOT NULL DEFAULT false,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "origin" character varying(100),
        "device_info" jsonb,
        "data" jsonb NOT NULL DEFAULT '{}',
        "external_code" character varying(255),
        "country" character varying(10),
        "counterparty_id" character varying(255),
        "counterparty_country" character varying(10),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )`,
    );

    // Primary aggregation index: organization + account + datetime
    await queryRunner.query(
      `CREATE INDEX "idx_tx_org_account_datetime" ON "transactions" ("id_organization", "id_account", "datetime")`,
    );

    // Organization-wide queries
    await queryRunner.query(
      `CREATE INDEX "idx_tx_org_datetime" ON "transactions" ("id_organization", "datetime")`,
    );

    // Type-filtered aggregations
    await queryRunner.query(
      `CREATE INDEX "idx_tx_org_account_type_datetime" ON "transactions" ("id_organization", "id_account", "type", "datetime")`,
    );

    // Organization index (required for tenant queries)
    await queryRunner.query(
      `CREATE INDEX "idx_transactions_id_organization" ON "transactions" ("id_organization")`,
    );

    // External code lookup (for deduplication)
    await queryRunner.query(
      `CREATE INDEX "idx_tx_org_external_code" ON "transactions" ("id_organization", "external_code") WHERE "external_code" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_tx_org_external_code"`);
    await queryRunner.query(`DROP INDEX "idx_transactions_id_organization"`);
    await queryRunner.query(`DROP INDEX "idx_tx_org_account_type_datetime"`);
    await queryRunner.query(`DROP INDEX "idx_tx_org_datetime"`);
    await queryRunner.query(`DROP INDEX "idx_tx_org_account_datetime"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
  }
}
