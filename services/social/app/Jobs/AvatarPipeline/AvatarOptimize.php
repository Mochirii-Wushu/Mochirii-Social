<?php

namespace App\Jobs\AvatarPipeline;

use App\Avatar;
use App\Profile;
use App\Services\AccountService;
use App\Services\AvatarUploadPolicy;
use App\Util\Media\ImageDriverManager;
use Cache;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Encoders\WebpEncoder;
use Storage;
use Throwable;

class AvatarOptimize implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $profile;

    protected $current;

    /**
     * Delete the job if its models no longer exist.
     *
     * @var bool
     */
    public $deleteWhenMissingModels = true;

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct(Profile $profile, $current)
    {
        $this->profile = $profile;
        $this->current = $current;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        $avatar = $this->profile->avatar;
        $file = storage_path('app/'.$avatar->media_path);
        if (! is_file($file)) {
            return;
        }

        $imageManager = ImageDriverManager::createImageManager();

        try {
            $source = file_get_contents($file);
            $primary = $imageManager->read($source)->coverDown(
                AvatarUploadPolicy::PRIMARY_SIZE,
                AvatarUploadPolicy::PRIMARY_SIZE
            );
            $thumbnail = $imageManager->read($source)->coverDown(
                AvatarUploadPolicy::THUMBNAIL_SIZE,
                AvatarUploadPolicy::THUMBNAIL_SIZE
            );

            $primaryEncoded = $this->encodeImage($primary);
            $thumbnailEncoded = $this->encodeImage($thumbnail, $primaryEncoded['extension']);
            $paths = $this->buildDerivativePaths($avatar, $primaryEncoded['extension']);

            file_put_contents(storage_path('app/'.$paths['primary']), $primaryEncoded['bytes']);
            file_put_contents(storage_path('app/'.$paths['thumbnail']), $thumbnailEncoded['bytes']);

            $avatar = Avatar::whereProfileId($this->profile->id)->firstOrFail();
            $oldCdnUrl = $avatar->cdn_url;
            $sourcePath = $avatar->media_path;
            $avatar->change_count = ++$avatar->change_count;
            $avatar->last_processed_at = Carbon::now();
            $avatar->media_path = $paths['primary'];
            $avatar->cdn_url = null;
            $avatar->size = strlen($primaryEncoded['bytes']);
            $avatar->save();
            $this->deleteOldAvatar($avatar->media_path, $this->current);

            if ((bool) config_cache('pixelfed.cloud_storage') && (bool) config_cache('instance.avatar.local_to_cloud')) {
                $this->uploadToCloud($avatar, $paths, $oldCdnUrl);
            }
            $this->deleteLocalSource($sourcePath);
            $this->forgetCaches($avatar);
        } catch (\Exception $e) {
        }
    }

    protected function encodeImage($image, $extension = null)
    {
        $quality = (int) config_cache('pixelfed.image_quality');

        if ($extension === 'jpg') {
            $encoded = (new JpegEncoder($quality))->encode($image);

            return [
                'bytes' => $encoded->toString(),
                'extension' => 'jpg',
                'mime' => 'image/jpeg',
            ];
        }

        try {
            $encoded = (new WebpEncoder($quality))->encode($image);

            return [
                'bytes' => $encoded->toString(),
                'extension' => 'webp',
                'mime' => 'image/webp',
            ];
        } catch (Throwable $e) {
            $encoded = (new JpegEncoder($quality))->encode($image);

            return [
                'bytes' => $encoded->toString(),
                'extension' => 'jpg',
                'mime' => 'image/jpeg',
            ];
        }
    }

    protected function buildDerivativePaths($avatar, $extension)
    {
        $base = pathinfo($avatar->media_path, PATHINFO_DIRNAME);
        $name = 'avatar_'.strtolower(Str::random(random_int(8, 12))).$avatar->change_count;

        return [
            'base' => $base,
            'primary' => $base.'/'.$name.'.'.$extension,
            'thumbnail' => $base.'/'.$name.'_thumb.'.$extension,
        ];
    }

    protected function deleteOldAvatar($new, $current)
    {
        $newPath = storage_path(sprintf('app/%s', $new));
        $matchesNewAvatar = $newPath == $current;
        $isDefaultAvatar = Str::endsWith($current, 'avatars/default.png') ||
            Str::endsWith($current, 'avatars/default.jpg');

        if (! $current || $matchesNewAvatar || $isDefaultAvatar) {
            return;
        }
        if (is_file($current)) {
            @unlink($current);
        }
    }

    protected function uploadToCloud($avatar, array $paths, $oldCdnUrl = null)
    {
        $base = 'cache/avatars/'.$avatar->profile_id;
        $disk = Storage::disk(config('filesystems.cloud'));
        $primaryName = pathinfo($paths['primary'], PATHINFO_BASENAME);
        $thumbnailName = pathinfo($paths['thumbnail'], PATHINFO_BASENAME);
        $primaryPath = $base.'/'.$primaryName;
        $thumbnailPath = $base.'/'.$thumbnailName;

        $disk->put($primaryPath, Storage::get($paths['primary']));
        $disk->put($thumbnailPath, Storage::get($paths['thumbnail']));

        $avatar->media_path = $primaryPath;
        $avatar->cdn_url = $disk->url($primaryPath);
        $avatar->save();
        $this->cleanupCloudAvatarDirectory($disk, $base, [$primaryPath, $thumbnailPath]);
        Storage::delete($paths['primary']);
        Storage::delete($paths['thumbnail']);
        $this->deleteOldCloudAvatar($disk, $oldCdnUrl, [$primaryPath, $thumbnailPath]);
    }

    protected function cleanupCloudAvatarDirectory($disk, $base, array $preserve)
    {
        $files = $disk->allFiles($base);
        foreach ($files as $file) {
            if (! in_array($file, $preserve, true)) {
                $disk->delete($file);
            }
        }
    }

    protected function deleteOldCloudAvatar($disk, $oldCdnUrl, array $preserve)
    {
        if (! $oldCdnUrl) {
            return;
        }

        $path = parse_url($oldCdnUrl, PHP_URL_PATH);
        if (! $path) {
            return;
        }

        $path = ltrim($path, '/');
        if ($path && ! in_array($path, $preserve, true)) {
            $disk->delete($path);
        }
    }

    protected function deleteLocalSource($sourcePath)
    {
        if (! $sourcePath || Str::startsWith($sourcePath, 'cache/avatars/')) {
            return;
        }

        if (Storage::exists($sourcePath)) {
            Storage::delete($sourcePath);
        }
    }

    protected function forgetCaches($avatar)
    {
        Cache::forget('avatar:'.$avatar->profile_id);
        AccountService::del($avatar->profile_id);
    }
}
