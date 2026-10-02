<?php

use App\Http\Controllers\PortalController;
use App\Http\Controllers\PortalActionController;
use App\Http\Controllers\WebsiteAuthController;
use App\Http\Controllers\WebsiteController;
use App\Http\Controllers\WebsiteLeadController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Services\MediaStorage;

Route::get('/', [WebsiteController::class, 'home'])->name('home');
Route::get('/properties/map', [WebsiteController::class, 'propertiesMap'])->name('properties.map');
Route::get('/properties', [WebsiteController::class, 'properties'])->name('properties.index');
Route::get('/properties/{id}', [WebsiteController::class, 'propertyDetail'])->where('id', '[^/]+')->name('properties.show');
Route::get('/agents', [WebsiteController::class, 'agents'])->name('agents.index');
Route::get('/agents/{id}', [WebsiteController::class, 'agentDetail'])->where('id', '[^/]+')->name('agents.show');
Route::get('/about', [WebsiteController::class, 'about'])->name('about');
Route::get('/contact', [WebsiteController::class, 'contact'])->name('contact');
Route::post('/contact', [WebsiteLeadController::class, 'contact'])->middleware('throttle:5,1')->name('contact.store');
Route::post('/newsletter', [WebsiteLeadController::class, 'newsletter'])->middleware('throttle:5,1')->name('newsletter.store');
Route::post('/property-inquiry', [WebsiteLeadController::class, 'contact'])->middleware('throttle:5,1')->name('property.inquiry.store');
Route::post('/properties/{id}/saved', [PortalActionController::class, 'saveProperty'])
    ->where('id', '[^/]+')
    ->middleware('throttle:20,1')
    ->name('property.saved.store');
Route::delete('/properties/{id}/saved', [PortalActionController::class, 'removeSavedProperty'])
    ->where('id', '[^/]+')
    ->middleware('throttle:20,1')
    ->name('property.saved.destroy');
Route::post('/properties/{id}/inquiries', [PortalActionController::class, 'storeInquiry'])
    ->where('id', '[^/]+')
    ->middleware('throttle:5,1')
    ->name('buyer.inquiry.store');
Route::get('/blog', [WebsiteController::class, 'blog'])->name('blog.index');
Route::get('/blog/{id}', [WebsiteController::class, 'blogDetail'])->where('id', '[^/]+')->name('blog.show');

foreach ([
    'privacy-policy' => 'privacy-policy.html',
    'privacy' => 'privacy-policy.html',
    'terms' => 'terms.html',
    'account-deletion' => 'account-deletion.html',
] as $path => $filename) {
    Route::get('/' . $path, fn () => response()->file(public_path('pages/' . $filename)))
        ->name('legal.' . $path);
}

Route::get('/login', [WebsiteAuthController::class, 'login'])->name('auth.login');
Route::post('/login', [WebsiteAuthController::class, 'authenticate'])->middleware('throttle:6,1')->name('auth.login.submit');
Route::get('/register', [WebsiteAuthController::class, 'register'])->name('auth.register');
Route::get('/auth', function (Request $request) {
    $mode = strtolower((string) $request->query('mode', $request->query('tab', 'register')));
    $route = in_array($mode, ['login', 'signin', 'sign-in'], true) ? 'auth.login' : 'auth.register';
    $role = strtolower((string) $request->query('role', 'buyer'));

    return redirect()->route($route, ['role' => $role]);
})->name('auth.compat');
Route::post('/register', [WebsiteAuthController::class, 'storeRegistration'])->middleware('throttle:4,1')->name('auth.register.submit');
Route::post('/logout', [WebsiteAuthController::class, 'logout'])->name('auth.logout');

Route::get('/admin/login', fn () => redirect()->route('auth.login', ['role' => 'admin']))->name('admin.login');
Route::post('/portal/seller/properties', [PortalActionController::class, 'storeProperty'])
    ->middleware('throttle:8,1')
    ->name('portal.property.store');
Route::post('/portal/admin/properties/{id}/{action}', [PortalActionController::class, 'moderateProperty'])
    ->where(['id' => '[^/]+', 'action' => 'approve|reject|request-changes|verify|feature'])
    ->middleware('throttle:30,1')
    ->name('portal.property.moderate');
Route::get('/portal/{role}/{page?}', [PortalController::class, 'show'])
    ->where(['role' => 'buyer|seller|agent|admin', 'page' => '.*'])
    ->name('portal.page');
foreach (['buyer', 'seller', 'agent', 'admin'] as $portalRole) {
    Route::get('/' . $portalRole . '/{page?}', fn (?string $page = null) => redirect()->route('portal.page', [
        'role' => $portalRole,
        'page' => $page ?: 'dashboard',
    ]))->where('page', '.*')->name($portalRole . '.portal');
}

// If MEDIA_STORAGE_DIR is outside public/, keep uploaded URLs readable while
// rejecting path traversal. The normal public/ path is still served directly.
Route::get('/images/uploads/{filename}', function (string $filename) {
    $file = app(MediaStorage::class)->fileForPublicPath('/images/uploads/' . $filename);
    abort_unless($file !== null && is_file($file), 404);

    return response()->file($file);
})->where('filename', '[^/]+');
