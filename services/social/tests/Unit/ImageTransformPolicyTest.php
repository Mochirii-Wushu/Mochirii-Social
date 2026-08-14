<?php

namespace Tests\Unit;

use App\Media;
use App\Util\Media\Image;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageTransformPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'filesystems.default' => 'local',
            'pixelfed.image_quality' => 80,
        ]);

        Storage::disk('local')->deleteDirectory('public/test-media');
        Storage::disk('local')->makeDirectory('public/test-media');
    }

    protected function tearDown(): void
    {
        Storage::disk('local')->deleteDirectory('public/test-media');

        parent::tearDown();
    }

    public function test_landscape_images_are_capped_to_mochirii_display_width()
    {
        $media = $this->mediaForImage('public/test-media/landscape.jpg', 1600, 1200, 'image/jpeg');

        $image = new Image;
        $image->resizeImage($media);

        [$width, $height] = getimagesize(storage_path('app/'.$media->media_path));

        $this->assertSame(Image::MAX_DISPLAY_WIDTH, $width);
        $this->assertSame(810, $height);
        $this->assertSame('landscape', $media->orientation);
    }

    public function test_portrait_images_are_capped_to_mochirii_portrait_height()
    {
        $media = $this->mediaForImage('public/test-media/portrait.jpg', 1200, 1800, 'image/jpeg');

        $image = new Image;
        $image->resizeImage($media);

        [$width, $height] = getimagesize(storage_path('app/'.$media->media_path));

        $this->assertSame(900, $width);
        $this->assertSame(Image::MAX_PORTRAIT_HEIGHT, $height);
        $this->assertSame('portrait', $media->orientation);
    }

    public function test_small_images_are_not_upscaled()
    {
        $media = $this->mediaForImage('public/test-media/small.jpg', 800, 600, 'image/jpeg');

        $image = new Image;
        $image->resizeImage($media);

        [$width, $height] = getimagesize(storage_path('app/'.$media->media_path));

        $this->assertSame(800, $width);
        $this->assertSame(600, $height);
    }

    public function test_thumbnail_generation_uses_square_downsampled_assets()
    {
        $media = $this->mediaForImage('public/test-media/thumb.jpg', 1600, 1200, 'image/jpeg');

        $image = new Image;
        $image->resizeThumbnail($media);

        [$width, $height] = getimagesize(storage_path('app/'.$media->thumbnail_path));

        $this->assertSame(Image::THUMBNAIL_SIZE, $width);
        $this->assertSame(Image::THUMBNAIL_SIZE, $height);
        $this->assertSame('public/test-media/thumb_thumb.jpg', $media->thumbnail_path);
    }

    protected function mediaForImage(string $path, int $width, int $height, string $mime): TestImageMedia
    {
        $absolutePath = storage_path('app/'.$path);
        $directory = dirname($absolutePath);

        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $canvas = imagecreatetruecolor($width, $height);
        $background = imagecolorallocate($canvas, 58, 95, 113);
        imagefilledrectangle($canvas, 0, 0, $width, $height, $background);
        imagejpeg($canvas, $absolutePath, 92);
        imagedestroy($canvas);

        return new TestImageMedia([
            'media_path' => $path,
            'mime' => $mime,
            'status_id' => null,
        ]);
    }
}

class TestImageMedia extends Media
{
    public function save(array $options = [])
    {
        return true;
    }
}
