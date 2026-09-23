<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('app_data')) {
            Schema::create('app_data', function (Blueprint $table) {
                $table->unsignedBigInteger('id')->primary();
                $table->json('data');
                $table->dateTime('updated_at', 3)->useCurrent();
            });
        }

        if (!Schema::hasTable('auth_sessions')) {
            Schema::create('auth_sessions', function (Blueprint $table) {
                $table->string('token_hash', 255)->primary();
                $table->unsignedBigInteger('user_id')->index('idx_auth_sessions_user');
                $table->dateTime('expires_at', 3)->index('idx_auth_sessions_expiry');
                $table->dateTime('created_at', 3)->useCurrent();
            });
        }

        if (!Schema::hasTable('auth_challenges')) {
            Schema::create('auth_challenges', function (Blueprint $table) {
                $table->string('email', 320);
                $table->string('purpose', 64);
                $table->char('code_hash', 64);
                $table->unsignedSmallInteger('attempts')->default(0);
                $table->dateTime('expires_at', 3);
                $table->primary(['email', 'purpose']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_challenges');
        Schema::dropIfExists('auth_sessions');
        Schema::dropIfExists('app_data');
    }
};