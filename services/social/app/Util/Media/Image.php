<?php

namespace App\Util\Media;

use App\Media;
use App\Services\StatusService;
use Cache;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Encoders\PngEncoder;
use Intervention\Image\Encoders\WebpEncoder;
use Log;
use Storage;

class Image
{
    public const MAX_DISPLAY_WIDTH = 1080;

    public const MAX_PORTRAIT_HEIGHT = 1350;

    public const THUMBNAIL_SIZE = 640;

    public $square;

    public $landscape;

    public $portrait;

    public $thumbnail;

    public $orientation;

    public $acceptedMimes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/avif',
        'image/heic',
    ];

    protected $imageManager;

    protected $defaultDisk;

    public function __construct()
    {
        ini_set('memory_limit', config('pixelfed.memory_limit', '1024M'));

        $this->square = $this->orientations()['square'];
        $this->landscape = $this->orientations()['landscape'];
        $this->portrait = $this->orientations()['portrait'];
        $this->thumbnail = [
            'width' => self::THUMBNAIL_SIZE,
            'height' => self::THUMBNAIL_SIZE,
        ];
        $this->orientation = null;

        $this->defaultDisk = config('filesystems.default');

        $this->imageManager = ImageDriverManager::createImageManager();
    }

    public function orientations()
    {
        return [
            'square' => [
                'width' => self::MAX_DISPLAY_WIDTH,
                'height' => self::MAX_DISPLAY_WIDTH,
            ],
            'landscape' => [
                'width' => self::MAX_DISPLAY_WIDTH,
                'height' => self::MAX_PORTRAIT_HEIGHT,
            ],
            'portrait' => [
                'width' => self::MAX_DISPLAY_WIDTH,
                'height' => self::MAX_PORTRAIT_HEIGHT,
            ],
        ];
    }

    public function getAspect($width, $height, $isThumbnail)
    {
        if ($isThumbnail) {
            return [
                'dimensions' => $this->thumbnail,
                'orientation' => 'thumbnail',
            ];
        }

        $aspect = $width / $height;
        $orientation = $aspect === 1 ? 'square' :
        ($aspect > 1 ? 'landscape' : 'portrait');
        $this->orientation = $orientation;

        return [
            'dimensions' => $this->orientations()[$orientation],
            'orientation' => $orientation,
            'width_original' => $width,
            'height_original' => $height,
        ];
    }

    public function resizeImage(Media $media)
    {
        $this->handleResizeImage($media);
    }

    public function resizeThumbnail(Media $media)
    {
        $this->handleThumbnailImage($media);
    }

    public function handleResizeImage(Media $media)
    {
        $this->handleImageTransform($media, false);
    }

    public function handleThumbnailImage(Media $media)
    {
        $this->handleImageTransform($media, true);
    }

    public function handleImageTransform(Media $media, $thumbnail = false)
    {
        $path = $media->media_path;
        $localFs = config('filesystems.default') === 'local';

        if (! in_array($media->mime, $this->acceptedMimes)) {
            return;
        }

        try {
            $fileContents = null;
            $tempFile = null;

            if ($this->defaultDisk === 'local') {
                $filePath = storage_path('app/'.$path);
                $fileContents = file_get_contents($filePath);
            } else {
                $fileContents = Storage::disk($this->defaultDisk)->get($path);
            }

            $fileInfo = pathinfo($path);
            $extension = strtolower($fileInfo['extension'] ?? 'jpg');
            $outputExtension = $extension;

            $metadata = null;
            if (! $thumbnail && config('media.exif.database', false) == true) {
                try {
                    if ($this->defaultDisk !== 'local') {
                        $tempFile = tempnam(sys_get_temp_dir(), 'exif_');
                        file_put_contents($tempFile, $fileContents);
                        $exifPath = $tempFile;
                    } else {
                        $exifPath = storage_path('app/'.$path);
                    }

                    $exif = @exif_read_data($exifPath);

                    if ($exif) {
                        $meta = [];
                        $keys = [
                            'FileName',
                            'FileSize',
                            'FileType',
                            'Make',
                            'Model',
                            'MimeType',
                            'ColorSpace',
                            'ExifVersion',
                            'Orientation',
                            'UserComment',
                            'XResolution',
                            'YResolution',
                            'FileDateTime',
                            'SectionsFound',
                            'ExifImageWidth',
                            'ResolutionUnit',
                            'ExifImageLength',
                            'FlashPixVersion',
                            'Exif_IFD_Pointer',
                            'YCbCrPositioning',
                            'ComponentsConfiguration',
                            'ExposureTime',
                            'FNumber',
                            'ISOSpeedRatings',
                            'ShutterSpeedValue',
                        ];
                        foreach ($exif as $k => $v) {
                            if (in_array($k, $keys)) {
                                $meta[$k] = $v;
                            }
                        }
                        $media->metadata = json_encode($meta);
                    }

                    if ($tempFile && file_exists($tempFile)) {
                        unlink($tempFile);
                        $tempFile = null;
                    }
                } catch (\Exception $e) {
                    if ($tempFile && file_exists($tempFile)) {
                        unlink($tempFile);
                    }
                    if (config('app.dev_log')) {
                        Log::info('EXIF extraction failed: '.$e->getMessage());
                    }
                }
            }

            $img = $this->imageManager->read($fileContents);

            $ratio = $this->getAspect($img->width(), $img->height(), $thumbnail);
            $aspect = $ratio['dimensions'];
            $orientation = $ratio['orientation'];

            if ($thumbnail) {
                $img = $img->coverDown(
                    $aspect['width'],
                    $aspect['height']
                );
            } else {
                if (
                    ($ratio['width_original'] > $aspect['width'])
                    || ($ratio['height_original'] > $aspect['height'])
                ) {
                    $img = $img->scaleDown(
                        $aspect['width'],
                        $aspect['height']
                    );
                }
            }

            $quality = config_cache('pixelfed.image_quality');
            $img = $this->stripMetadata($img);

            $encoder = null;
            switch ($extension) {
                case 'jpeg':
                case 'jpg':
                    $encoder = new JpegEncoder($quality);
                    $outputExtension = 'jpg';
                    break;
                case 'png':
                    $encoder = new PngEncoder;
                    $outputExtension = 'png';
                    break;
                case 'webp':
                    $encoder = new WebpEncoder($quality);
                    $outputExtension = 'webp';
                    break;
                case 'avif':
                    $encoder = new JpegEncoder($quality);
                    $outputExtension = 'jpg';
                    break;
                case 'heic':
                    $encoder = new JpegEncoder($quality);
                    $outputExtension = 'jpg';
                    break;
                default:
                    $encoder = new JpegEncoder($quality);
                    $outputExtension = 'jpg';
            }

            $converted = $this->setBaseName($path, $thumbnail, $outputExtension);
            $encoded = $encoder->encode($img);
            $encodedContents = $this->stripEncodedMetadata($encoded->toString(), $outputExtension, $quality);

            if ($localFs) {
                $newPath = storage_path('app/'.$converted['path']);
                file_put_contents($newPath, $encodedContents);
            } else {
                Storage::disk($this->defaultDisk)->put(
                    $converted['path'],
                    $encodedContents
                );
            }

            if ($thumbnail == true) {
                $media->thumbnail_path = $converted['path'];
                $media->thumbnail_url = url(Storage::url($converted['path']));
            } else {
                $media->width = $img->width();
                $media->height = $img->height();
                $media->orientation = $orientation;
                $media->media_path = $converted['path'];
                $media->mime = 'image/'.$outputExtension;
            }

            $media->save();

            if ($thumbnail) {
                $this->generateBlurhash($media);
            }

            if ($media->status_id) {
                Cache::forget('status:transformer:media:attachments:'.$media->status_id);
                Cache::forget('status:thumb:'.$media->status_id);
                StatusService::del($media->status_id);
            }

        } catch (\Exception $e) {
            if (config('app.dev_log')) {
                Log::info('MediaResizeException: '.$e->getMessage().' | Could not process media id: '.$media->id);
            }
        }
    }

    public function setBaseName($basePath, $thumbnail, $extension)
    {
        $pathInfo = pathinfo($basePath);
        $dir = isset($pathInfo['dirname']) && $pathInfo['dirname'] !== '.' ? $pathInfo['dirname'] . '/' : '';
        $filename = $pathInfo['filename'];
        $name = ($thumbnail == true) ? $filename . '_thumb' : $filename;
        $basePath = $dir . $name . '.' . $extension;

        return ['path' => $basePath, 'png' => false];
    }

    protected function stripMetadata($img)
    {
        try {
            if (method_exists($img, 'removeProfile')) {
                $img = $img->removeProfile();
            }
        } catch (\Throwable $e) {
            if (config('app.dev_log')) {
                Log::info('Image profile removal failed: '.$e->getMessage());
            }
        }

        try {
            $driver = get_class($this->imageManager->driver());
            $modifier = null;

            if (str_contains($driver, '\\Vips\\')) {
                $modifier = \Intervention\Image\Drivers\Vips\Modifiers\StripMetaModifier::class;
            } elseif (str_contains($driver, '\\Imagick\\')) {
                $modifier = \Intervention\Image\Drivers\Imagick\Modifiers\StripMetaModifier::class;
            }

            if ($modifier && class_exists($modifier)) {
                $img = $img->modify(new $modifier);
            }
        } catch (\Throwable $e) {
            if (config('app.dev_log')) {
                Log::info('Image metadata strip failed: '.$e->getMessage());
            }
        }

        return $img;
    }

    protected function stripEncodedMetadata(string $contents, string $extension, int $quality): string
    {
        if (! class_exists(\Imagick::class)) {
            return $contents;
        }

        try {
            $image = new \Imagick;
            $image->readImageBlob($contents);

            foreach ($image as $frame) {
                $frame->stripImage();
                $frame->setImageProperty('comment', '');
            }

            $format = match ($extension) {
                'jpg', 'jpeg' => 'jpeg',
                'png' => 'png',
                'webp' => 'webp',
                default => $extension,
            };
            $image->setImageFormat($format);

            if (in_array($format, ['jpeg', 'webp'], true)) {
                $image->setImageCompressionQuality($quality);
            }

            $stripped = $image->getImagesBlob();
            $image->clear();

            return $stripped ?: $contents;
        } catch (\Throwable $e) {
            if (config('app.dev_log')) {
                Log::info('Encoded image metadata strip failed: '.$e->getMessage());
            }

            return $contents;
        }
    }

    protected function generateBlurhash($media)
    {
        try {
            if ($this->defaultDisk === 'local') {
                $thumbnailPath = storage_path('app/'.$media->thumbnail_path);
                $blurhash = Blurhash::generate($media, $thumbnailPath);
            } else {
                $tempFile = tempnam(sys_get_temp_dir(), 'blurhash_');
                $contents = Storage::disk($this->defaultDisk)->get($media->thumbnail_path);
                file_put_contents($tempFile, $contents);

                $blurhash = Blurhash::generate($media, $tempFile);

                unlink($tempFile);
            }

            if ($blurhash) {
                $media->blurhash = $blurhash;
                $media->save();
            }
        } catch (\Exception $e) {
            if (config('app.dev_log')) {
                Log::info('Blurhash generation failed: '.$e->getMessage());
            }
        }
    }
}
