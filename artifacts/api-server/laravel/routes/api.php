<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\MobileAgentController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Middleware\LegacyBearerAuth;
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
    });
};

// Keep direct API paths for local service testing and add the artifact's
// path-prefixed routes for the Replit preview proxy.
Route::prefix('api')->group($registerRoutes);
Route::prefix('api-legacy/api')->group($registerRoutes);
