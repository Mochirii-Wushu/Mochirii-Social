<?php

namespace Tests\Unit;

use App\Services\AvatarService;
use App\Services\AvatarUploadPolicy;
use Tests\TestCase;

class AvatarUploadPolicyTest extends TestCase
{
    public function test_avatar_policy_matches_mochirii_upload_limits()
    {
        config([
            'instance.enable_cc' => false,
            'pixelfed.max_avatar_size' => 102400,
        ]);

        $this->assertSame(102400, AvatarUploadPolicy::maxSizeKb());
        $this->assertSame(640, AvatarUploadPolicy::PRIMARY_SIZE);
        $this->assertSame(320, AvatarUploadPolicy::THUMBNAIL_SIZE);
        $this->assertSame(
            'image/jpeg,image/jpg,image/png,image/webp',
            AvatarUploadPolicy::mimeTypes()
        );
        $this->assertSame(
            'required|file|mimetypes:image/jpeg,image/jpg,image/png,image/webp|max:102400',
            AvatarUploadPolicy::validationRule()
        );
    }

    public function test_avatar_cleanup_preserves_matching_thumbnail_name()
    {
        $this->assertSame('avatar_abc123_thumb.webp', AvatarService::thumbnailName('avatar_abc123.webp'));
        $this->assertSame('avatar_abc123_thumb.jpg', AvatarService::thumbnailName('avatar_abc123.jpg'));
    }
}
