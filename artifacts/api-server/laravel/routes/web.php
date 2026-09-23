<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// If MEDIA_STORAGE_DIR is outside public/, keep uploaded URLs readable while
// rejecting path traversal. The normal public/ path is still served directly.
Route::get('/images/uploads/{filename}', function (string $filename) {
    $configuredDirectory = (string) env('MEDIA_STORAGE_DIR', 'public/images/uploads');
    $directory = str_starts_with($configuredDirectory, DIRECTORY_SEPARATOR)
        ? $configuredDirectory
        : base_path($configuredDirectory);
    $file = $directory . DIRECTORY_SEPARATOR . basename($filename);
    abort_unless(is_file($file), 404);
    return response()->file($file);
})->where('filename', '[^/]+');
