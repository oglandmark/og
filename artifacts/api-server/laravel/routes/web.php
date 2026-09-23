<?php

use Illuminate\Support\Facades\Route;
use App\Services\MediaStorage;

Route::get('/', function () {
    return view('welcome');
});

// If MEDIA_STORAGE_DIR is outside public/, keep uploaded URLs readable while
// rejecting path traversal. The normal public/ path is still served directly.
Route::get('/images/uploads/{filename}', function (string $filename) {
    $file = app(MediaStorage::class)->fileForPublicPath('/images/uploads/' . $filename);
    abort_unless($file !== null && is_file($file), 404);

    return response()->file($file);
})->where('filename', '[^/]+');
