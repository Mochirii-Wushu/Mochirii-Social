<?php

namespace App\Services;

class AvatarUploadPolicy
{
    public const MIME_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
    ];

    public const PRIMARY_SIZE = 640;

    public const THUMBNAIL_SIZE = 320;

    public static function maxSizeKb(): int
    {
        return (int) config_cache('pixelfed.max_avatar_size');
    }

    public static function mimeTypes(): string
    {
        return implode(',', self::MIME_TYPES);
    }

    public static function validationRule(string $presence = 'required'): string
    {
        return $presence.'|file|mimetypes:'.self::mimeTypes().'|max:'.self::maxSizeKb();
    }

    public static function allowedLabel(): string
    {
        return 'JPEG, PNG, or WebP';
    }

    public static function config(): array
    {
        return [
            'max_size' => self::maxSizeKb(),
            'media_types' => self::mimeTypes(),
            'mime_types' => self::MIME_TYPES,
            'primary_size' => self::PRIMARY_SIZE,
            'thumbnail_size' => self::THUMBNAIL_SIZE,
        ];
    }
}
