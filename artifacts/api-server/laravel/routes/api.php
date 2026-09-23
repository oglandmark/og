<?php

use App\Http\Controllers\ApiController;
use Illuminate\Support\Facades\Route;

Route::options('/{path?}', fn () => response('', 204)->withHeaders([
    'Access-Control-Allow-Origin' => '*',
    'Access-Control-Allow-Headers' => 'Authorization, Content-Type',
    'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
]))->where('path', '.*');

Route::any('/{path?}', [ApiController::class, 'handle'])->where('path', '.*');