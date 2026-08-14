<template>
    <div class="footer-component">
        <div class="footer-component-links">
            <a href="/site/help">Help</a>
            <div class="spacer">·</div>
            <a href="/site/terms">Terms</a>
            <div class="spacer">·</div>
            <a href="/site/privacy">Privacy</a>
            <div class="spacer">·</div>
            <a v-if="config.show_legal_notice_link" href="/site/legal-notice">Legal Notice</a>
            <div v-if="config.show_legal_notice_link" class="spacer">·</div>
            <a href="https://mochirii.com/social">Mochirii</a>
        </div>

        <div class="footer-component-attribution">
            <div><span>© {{ getYear() }} {{ config.domain }}</span></div>
            <div class="spacer">·</div>
            <div><span>Mochirii Social</span></div>
        </div>
    </div>
</template>

<script type="text/javascript">
export default {
    data() {
        return {
            config: window.pfl
        }
    },

    methods: {
        getYear() {
            return (new Date().getFullYear());
        }
    }
}
</script>
