<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

final class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::connection()->select('select 1');
            $hasData = Schema::hasTable('app_data');
            $hasCanonicalRow = $hasData && DB::table('app_data')->where('id', 1)->exists();
            $ready = $hasData && $hasCanonicalRow;
            return response()->json([
                'status' => $ready ? 'ok' : 'degraded',
                'database' => ! $hasData ? 'app_data_missing' : ($hasCanonicalRow ? 'connected' : 'app_data_empty'),
                'databaseProvider' => DB::connection()->getDriverName(),
                'api' => 'og-landmark-laravel',
            ], $ready ? 200 : 503);
        } catch (Throwable) {
            return response()->json([
                'status' => 'degraded',
                'database' => 'unavailable',
                'databaseProvider' => config('database.default'),
                'api' => 'og-landmark-laravel',
            ], 503);
        }
    }
}
