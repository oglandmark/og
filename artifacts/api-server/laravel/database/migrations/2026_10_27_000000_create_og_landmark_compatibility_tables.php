<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Existing installations already have this canonical document table.
        // Never replace or seed its live row from a repository snapshot.
        if (! Schema::hasTable('app_data')) {
            Schema::create('app_data', function (Blueprint $table): void {
                $table->unsignedBigInteger('id')->primary();
                $table->json('data');
                $table->timestamp('updated_at')->useCurrent();
            });
        }

        if (! Schema::hasTable('auth_sessions')) {
            Schema::create('auth_sessions', function (Blueprint $table): void {
                $table->string('token_hash', 255)->primary();
                $table->unsignedBigInteger('user_id')->index();
                $table->timestamp('expires_at')->index();
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (! Schema::hasTable('auth_challenges')) {
            Schema::create('auth_challenges', function (Blueprint $table): void {
                $table->string('email', 320);
                $table->string('purpose', 64);
                $table->char('code_hash', 64);
                $table->unsignedSmallInteger('attempts')->default(0);
                $table->timestamp('expires_at');
                $table->primary(['email', 'purpose']);
            });
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive: these tables may contain legacy data.
    }
};
