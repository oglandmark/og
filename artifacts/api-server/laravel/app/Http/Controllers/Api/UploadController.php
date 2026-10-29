<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class UploadController extends Controller
{
    private const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
    private const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

    public function singleImage(Request $request): JsonResponse
    {
        $image = $request->file('image');
        if (! $image instanceof UploadedFile) {
            throw ValidationException::withMessages(['image' => ['Choose an image to upload.']]);
        }

        $this->validateMedia($image, 'image');
        return response()->json(['url' => $this->store($image)]);
    }

    public function imageCollection(Request $request): JsonResponse
    {
        $images = $request->file('images', []);
        if ($images instanceof UploadedFile) $images = [$images];
        if (! is_array($images) || count($images) < 1 || count($images) > 30) {
            throw ValidationException::withMessages([
                'images' => ['Upload between 1 and 30 images.'],
            ]);
        }

        foreach ($images as $image) {
            if (! $image instanceof UploadedFile) {
                throw ValidationException::withMessages(['images' => ['Each upload must be an image file.']]);
            }
            $this->validateMedia($image, 'image');
        }

        $urls = [];
        try {
            foreach ($images as $image) $urls[] = $this->store($image);
        } catch (\Throwable $error) {
            $this->deleteStoredUrls($urls);
            throw $error;
        }

        return response()->json(['urls' => $urls]);
    }

    public function video(Request $request): JsonResponse
    {
        $video = $request->file('video');
        if (! $video instanceof UploadedFile) {
            throw ValidationException::withMessages(['video' => ['Choose a video to upload.']]);
        }

        $this->validateMedia($video, 'video');
        return response()->json(['url' => $this->store($video)]);
    }

    private function validateMedia(UploadedFile $file, string $kind): void
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $mime = strtolower((string) $file->getMimeType());
        $allowedExtensions = $kind === 'image' ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp4', 'mov'];
        $allowedMimes = $kind === 'image'
            ? ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
            : ['video/mp4', 'video/quicktime'];
        $sizeLimit = $kind === 'image' ? self::MAX_IMAGE_BYTES : self::MAX_VIDEO_BYTES;
        $field = $kind === 'image' ? 'image' : 'video';

        if (! in_array($extension, $allowedExtensions, true)
            || ! in_array($mime, $allowedMimes, true)) {
            throw ValidationException::withMessages([
                $field => [$kind === 'image'
                    ? 'Allowed image formats are JPG, PNG, and WebP.'
                    : 'Allowed video formats are MP4 and MOV.'],
            ]);
        }
        if ($file->getSize() > $sizeLimit) {
            throw ValidationException::withMessages([
                $field => [$kind === 'image'
                    ? 'Images must be 20 MiB or smaller.'
                    : 'Videos must be 300 MiB or smaller.'],
            ]);
        }
    }

    private function store(UploadedFile $file): string
    {
        $path = $file->storePublicly('listing-media', 'public');
        if (! is_string($path) || $path === '') {
            throw new RuntimeException('Media storage could not save the uploaded file.');
        }

        return '/api/admin/property-media/'.rawurlencode(basename($path));
    }

    private function deleteStoredUrls(array $urls): void
    {
        $paths = [];
        foreach ($urls as $url) {
            $filename = basename((string) parse_url($url, PHP_URL_PATH));
            if ($filename !== '') $paths[] = 'listing-media/'.$filename;
        }
        if ($paths) Storage::disk('public')->delete($paths);
    }
}
