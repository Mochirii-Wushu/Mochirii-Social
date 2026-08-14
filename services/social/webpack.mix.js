let mix = require('laravel-mix');
const fs = require("fs");
const path = require("path");

function sanitizePublicJsBuildPaths() {
    const publicJsDir = path.join(__dirname, 'public/js');

    if (!fs.existsSync(publicJsDir)) {
        return;
    }

    const localZipBaseUriPattern = /baseURI:"file:\/\/\/[^"]*node_modules\/@zip\.js\/zip\.js\/lib\/zip-core-base\.js"/g;

    for (const fileName of fs.readdirSync(publicJsDir)) {
        if (!fileName.endsWith('.js')) {
            continue;
        }

        const filePath = path.join(publicJsDir, fileName);
        const contents = fs.readFileSync(filePath, 'utf8');
        const sanitized = contents.replace(
            localZipBaseUriPattern,
            'baseURI:globalThis.location.origin+"/"'
        );

        if (sanitized !== contents) {
            fs.writeFileSync(filePath, sanitized);
        }
    }
}

mix.before(() => {
    fs.rmSync('public/css', { recursive: true, force: true });
    fs.rmSync('public/js', { recursive: true, force: true });
});


mix.sass('resources/assets/sass/app.scss', 'public/css')
.sass('resources/assets/sass/appdark.scss', 'public/css')
.sass('resources/assets/sass/admin.scss', 'public/css')
.sass('resources/assets/sass/portfolio.scss', 'public/css')
.sass('resources/assets/sass/spa.scss', 'public/css')
.sass('resources/assets/sass/profile.scss', 'public/css')
.sass('resources/assets/sass/landing.scss', 'public/css').version();

mix.js('resources/assets/js/app.js', 'public/js')
.js('resources/assets/js/activity.js', 'public/js')
.js('resources/assets/js/components.js', 'public/js')
.js('resources/assets/js/discover.js', 'public/js')
.js('resources/assets/js/profile.js', 'public/js')
.js('resources/assets/js/status.js', 'public/js')
.js('resources/assets/js/timeline.js', 'public/js')
.js('resources/assets/js/compose.js', 'public/js')
.js('resources/assets/js/compose-classic.js', 'public/js')
.js('resources/assets/js/search.js', 'public/js')
.js('resources/assets/js/developers.js', 'public/js')
.js('resources/assets/js/hashtag.js', 'public/js')
.js('resources/assets/js/collectioncompose.js', 'public/js')
.js('resources/assets/js/collections.js', 'public/js')
.js('resources/assets/js/profile-directory.js', 'public/js')
.js('resources/assets/js/story-compose.js', 'public/js')
.js('resources/assets/js/direct.js', 'public/js')
.js('resources/assets/js/admin.js', 'public/js')
.js('resources/assets/js/spa.js', 'public/js')
.js('resources/assets/js/stories.js', 'public/js')
.js('resources/assets/js/portfolio.js', 'public/js')
.js('resources/assets/js/account-import.js', 'public/js')
.js('resources/assets/js/admin_invite.js', 'public/js')
.js('resources/assets/js/landing.js', 'public/js')
.js('resources/assets/js/remote_auth.js', 'public/js')
.js('resources/assets/js/groups.js', 'public/js')
.js('resources/assets/js/group-status.js', 'public/js')
.js('resources/assets/js/group-topic-feed.js', 'public/js')
.js('resources/assets/js/custom_filters.js', 'public/js')
.js('resources/assets/js/settings.js', 'public/js')
.vue({ version: 2 });

mix.extract();
mix.version();

const TerserPlugin = require('terser-webpack-plugin');

mix.options({
    processCssUrls: false,
    terser: {
        parallel: true,
        terserOptions: {
            compress: true,
            output: {
                comments: false
            }
        }
    }
})
mix.alias({
    '@': path.join(__dirname, 'resources/assets/components'),
    '~': path.join(__dirname, 'resources/assets/js/components'),
});
mix.webpackConfig({
    optimization: {
        providedExports: false,
        sideEffects: false,
        usedExports: false,
        minimize: true,
        minimizer: [ new TerserPlugin({
            extractComments: false,
        })]
    },
    output: {
        chunkLoadingGlobal: 'webpackChunkmochiriiSocial',
        uniqueName: 'mochirii-social',
        chunkFilename: 'js/[name].[chunkhash].js',
    }
});
mix.autoload({
    jquery: ['$', 'jQuery', 'window.jQuery']
});

mix.after(() => {
    sanitizePublicJsBuildPaths();
});
