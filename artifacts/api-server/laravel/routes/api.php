<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MobileAgentController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Middleware\LegacyBearerAuth;
use App\Http\Middleware\LegacyAdminAuth;
use Illuminate\Support\Facades\Route;

$registerRoutes = static function (): void {
    Route::get('/health', HealthController::class);
    Route::prefix('auth')->group(function (): void {
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::middleware(LegacyBearerAuth::class)->get('/me', [AuthController::class, 'me']);
    });

    Route::get('/properties', [PropertyController::class, 'index']);
    Route::get('/properties/{id}', [PropertyController::class, 'show'])->whereNumber('id');
    Route::get('/mobile-agents', [MobileAgentController::class, 'index']);
    Route::middleware(LegacyBearerAuth::class)->group(function (): void {
        Route::get('/my-properties', [PropertyController::class, 'mine']);
        Route::post('/properties', [PropertyController::class, 'store']);
        Route::put('/properties/{id}', [PropertyController::class, 'update'])->whereNumber('id');
        Route::delete('/properties/{id}', [PropertyController::class, 'destroy'])->whereNumber('id');
        Route::patch('/properties/{id}/listing-status', [PropertyController::class, 'setListingStatus'])->whereNumber('id');
        Route::patch('/properties/{id}/resubmit', [PropertyController::class, 'resubmit'])->whereNumber('id');
        Route::middleware(LegacyAdminAuth::class)->group(function (): void {
            Route::get('/admin/users', [AdminController::class, 'users']);
            Route::put('/admin/users/{id}', [AdminController::class, 'updateUser']);
            Route::patch('/admin/users/{id}/role', [AdminController::class, 'updateUserRole']);
            Route::patch('/admin/users/{id}/permissions', [AdminController::class, 'updateUserPermissions']);
            Route::delete('/admin/users/{id}', [AdminController::class, 'deleteUser']);
            Route::get('/admin/users/{id}/activity', [AdminController::class, 'userActivity']);
            Route::get('/admin/reports', [AdminController::class, 'reports']);
            Route::patch('/admin/reports/{id}', [AdminController::class, 'updateReport']);
            Route::get('/admin/properties', [AdminController::class, 'properties']);
            Route::get('/admin/properties/{id}/review', [AdminController::class, 'propertyReview'])->whereNumber('id');
            Route::patch('/admin/properties/{id}/media', [AdminController::class, 'updatePropertyMedia'])->whereNumber('id');
            Route::patch('/properties/{id}/{action}', [AdminController::class, 'moderateProperty'])
                ->whereNumber('id')->whereIn('action', ['approve', 'reject', 'request-changes']);
            Route::get('/admin/mobile-agents', [AdminController::class, 'mobileAgents']);
            Route::patch('/admin/mobile-agents/{id}', [AdminController::class, 'updateMobileAgent']);
        });
    });
    Route::get('/admin/property-media/{filename}', [AdminController::class, 'propertyMedia'])
        ->where('filename', '[A-Za-z0-9._-]+');
};

// Keep direct API paths for local service testing and add the artifact's
// path-prefixed routes for the Replit preview proxy.
Route::prefix('api')->group($registerRoutes);
Route::prefix('api-legacy/api')->group($registerRoutes);
