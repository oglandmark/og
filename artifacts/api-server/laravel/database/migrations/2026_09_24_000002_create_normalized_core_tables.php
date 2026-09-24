<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('app_users')) {
            Schema::create('app_users', function (Blueprint $table) {
                $table->unsignedBigInteger('id')->primary();
                $table->unsignedInteger('position')->default(0);
                $table->string('name', 255)->nullable();
                $table->string('email', 320)->nullable();
                $table->string('username', 191)->nullable();
                $table->string('phone', 96)->nullable();
                $table->string('city', 191)->nullable();
                $table->string('role', 64)->nullable();
                $table->string('status', 64)->nullable();
                $table->string('password_hash', 255)->nullable();
                $table->text('profile_photo_url')->nullable();
                $table->text('cover_photo_url')->nullable();
                $table->json('payload');
                $table->timestamps(3);
                $table->index('email', 'idx_app_users_email');
                $table->index('username', 'idx_app_users_username');
                $table->index('phone', 'idx_app_users_phone');
                $table->index(['role', 'status'], 'idx_app_users_role_status');
            });
        }

        if (!Schema::hasTable('properties')) {
            Schema::create('properties', function (Blueprint $table) {
                $table->unsignedBigInteger('id')->primary();
                $table->unsignedInteger('position')->default(0);
                $table->string('seller_id', 191)->nullable();
                $table->string('title', 255)->nullable();
                $table->string('city', 191)->nullable();
                $table->string('property_type', 100)->nullable();
                $table->string('purpose', 64)->nullable();
                $table->string('approval_status', 64)->nullable();
                $table->string('listing_status', 64)->nullable();
                $table->decimal('price_value', 30, 8)->nullable();
                $table->json('payload');
                $table->timestamps(3);
                $table->index('seller_id', 'idx_properties_seller');
                $table->index(['city', 'property_type'], 'idx_properties_city_type');
                $table->index(['approval_status', 'listing_status'], 'idx_properties_status');
            });
        }

        if (!Schema::hasTable('agents')) {
            Schema::create('agents', function (Blueprint $table) {
                $table->string('directory', 32);
                $table->string('legacy_id', 191);
                $table->unsignedInteger('position')->default(0);
                $table->string('name', 255)->nullable();
                $table->string('city', 191)->nullable();
                $table->string('phone', 96)->nullable();
                $table->string('status', 64)->nullable();
                $table->text('profile_photo_url')->nullable();
                $table->text('cover_photo_url')->nullable();
                $table->json('payload');
                $table->timestamps(3);
                $table->primary(['directory', 'legacy_id']);
                $table->index(['directory', 'city'], 'idx_agents_directory_city');
            });
        }

        if (!Schema::hasTable('media_assets')) {
            Schema::create('media_assets', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('owner_type', 32);
                $table->string('owner_id', 191);
                $table->string('field_path', 255);
                $table->string('media_type', 16);
                $table->unsignedInteger('position')->default(0);
                $table->text('url');
                $table->timestamps(3);
                $table->index(['owner_type', 'owner_id'], 'idx_media_owner');
                $table->index('media_type', 'idx_media_type');
            });
        }

        if (!Schema::hasTable('normalization_state')) {
            Schema::create('normalization_state', function (Blueprint $table) {
                $table->string('state_key', 64)->primary();
                $table->char('source_checksum', 64);
                $table->json('counts');
                $table->dateTime('activated_at', 3);
                $table->dateTime('updated_at', 3);
            });
        }
    }

    public function down(): void
    {
        foreach (['app_users', 'properties', 'agents', 'media_assets'] as $table) {
            if (Schema::hasTable($table) && DB::table($table)->exists()) {
                throw new \RuntimeException(
                    "Refusing to drop {$table}: normalized OG Landmark data exists and must be kept for rollback.",
                );
            }
        }

        if (Schema::hasTable('normalization_state') && DB::table('normalization_state')->exists()) {
            throw new \RuntimeException(
                'Refusing to drop normalization_state: normalized storage has been activated.',
            );
        }

        Schema::dropIfExists('normalization_state');
        Schema::dropIfExists('media_assets');
        Schema::dropIfExists('agents');
        Schema::dropIfExists('properties');
        Schema::dropIfExists('app_users');
    }
};