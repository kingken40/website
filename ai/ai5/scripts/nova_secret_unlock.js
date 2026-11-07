/* Shared secret-unlock gate: three quick clicks on the arc reactor open one password prompt.
   Each hidden feature registers its own password and a toggle callback. */
(function (root) {
    'use strict';
    if (!root.document) return;
    const doc = root.document;
    const features = [];

    function register(password, toggle) {
        features.push({ password, toggle });
    }

    function handlePassword(entered) {
        if (entered == null) return false;
        const match = features.find(f => f.password === String(entered).trim());
        if (!match) return false;
        match.toggle();
        return true;
    }

    function setup() {
        doc.querySelectorAll('.arc-reactor, #mobileAvatar').forEach(reactor => {
            if (reactor.dataset.secretTrigger) return;
            reactor.dataset.secretTrigger = '1';
            let clickCount = 0;
            let clickTimer = null;
            reactor.addEventListener('click', () => {
                clickCount++;
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => { clickCount = 0; }, 800);
                } else if (clickCount === 3) {
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    handlePassword(root.prompt('Enter password:'));
                }
            });
        });
    }

    root.NovaSecrets = { register, handlePassword };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', setup);
    else setup();
})(typeof window !== 'undefined' ? window : globalThis);
