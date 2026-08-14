// Mobile call mode initializer extracted from AI_v5_nova.html

    (function initMobileCallMode() {
        // Only activate on mobile viewports
        if (window.innerWidth > 768) return;

        var avatarContainer  = document.getElementById('mobileAvatarContainer');
        var statusDot        = document.getElementById('mobileStatusDot');
        var statusText       = document.getElementById('mobileStatusText');
        var muteBtn          = document.getElementById('mobileMuteBtn');
        var continueBtn      = document.getElementById('mobileContinueBtn');
        var chatBtn          = document.getElementById('mobileChatBtn');
        var settingsBtn      = document.getElementById('mobileSettingsBtn');
        var topSettingsBtn   = document.getElementById('mobileTopSettingsBtn');
        var mobileCallUI     = document.getElementById('mobileCallUI');
        var transcript       = document.getElementById('mobileTranscript');
        var transcriptToggle = document.getElementById('mobileTranscriptToggle');
        var transcriptMsgs   = document.getElementById('mobileTranscriptMessages');
        var mobileMessageInput = document.getElementById('mobileMessageInput');
        var mobileSendBtn      = document.getElementById('mobileSendBtn');
        var srcMsgs          = document.getElementById('chatMessages');

        var muted              = false;
        var mobileAlwaysListeningEnabled = true;
        var transcriptCollapsed = false;
        var holdToggleTimer = null;
        var holdToggleTriggered = false;
        var suppressNextMuteClick = false;
        var HOLD_TOGGLE_MS = 3000;

        var lastMobileSettingsTapAt = 0;

        function openSettingsFromMobile(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();

                // iOS can fire touch/pointer + click for a single tap.
                // Ignore the synthetic click that follows a real touch tap.
                if (event.type === 'click' && (Date.now() - lastMobileSettingsTapAt) < 500) {
                    return;
                }
                if (event.type === 'touchend' || event.type === 'pointerup') {
                    lastMobileSettingsTapAt = Date.now();
                }
            }

            if (typeof window.openSettings === 'function') {
                window.openSettings();
                return;
            }
            var modal = document.getElementById('settingsModal');
            if (!modal) return;
            modal.style.display = 'flex';
            modal.classList.add('active');
        }

        function bindMobileSettingsButton(button) {
            if (!button) return;
            button.addEventListener('click', openSettingsFromMobile);
            button.addEventListener('pointerup', openSettingsFromMobile);
            button.addEventListener('touchend', openSettingsFromMobile);
        }

        bindMobileSettingsButton(settingsBtn);
        bindMobileSettingsButton(topSettingsBtn);

        // â”€â”€ Sync desktop chatMessages â†’ mobile transcript â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function syncMessages() {
            if (!srcMsgs || !transcriptMsgs) return;
            transcriptMsgs.innerHTML = srcMsgs.innerHTML;
            transcriptMsgs.scrollTop = transcriptMsgs.scrollHeight;
        }

        if (srcMsgs) {
            new MutationObserver(syncMessages)
                .observe(srcMsgs, { childList: true, subtree: true, characterData: true });
            syncMessages();
        }

        if (mobileMessageInput && mobileSendBtn) {
            mobileMessageInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    mobileSendBtn.click();
                }
            });
        }

        // â”€â”€ Update avatar + status pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function setCallState(state) {
            if (avatarContainer) {
                avatarContainer.className = 'mobile-avatar-container' + (state ? ' ' + state : '');
            }
            if (statusDot) {
                statusDot.className = 'mobile-status-dot' + (state ? ' ' + state : '');
            }
            if (statusText) {
                if (state === 'speaking')    statusText.textContent = 'N.O.V.A is speakingâ€¦';
                else if (state === 'processing') statusText.textContent = 'Processingâ€¦';
                else if (state === 'muted')  statusText.textContent = 'Microphone muted';
                else if (state === 'disabled') statusText.textContent = 'Always listening off';
                else                         statusText.textContent = 'Always listeningâ€¦';
            }
        }

        // Poll voice/speaking flags exposed by nova_voice.js
        setInterval(function() {
            if (!mobileAlwaysListeningEnabled)                  { setCallState('disabled');   return; }
            if (muted)                                        { setCallState('muted');      return; }
            if (window.isSpeaking || window.isSpeechOutputActive) { setCallState('speaking');   return; }
            if (document.querySelector('.thinking-indicator'))    { setCallState('processing'); return; }
            setCallState('listening');
        }, 350);

        function updateMuteButtonUI() {
            if (!muteBtn) return;
            var icon = muteBtn.querySelector('i');
            var label = muteBtn.querySelector('span');
            var isOff = !mobileAlwaysListeningEnabled || muted;
            if (icon) icon.className = isOff ? 'fas fa-microphone-slash' : 'fas fa-microphone';
            if (label) {
                if (!mobileAlwaysListeningEnabled) {
                    label.textContent = 'Mic Off';
                } else {
                    label.textContent = muted ? 'Unmute' : 'Mute';
                }
            }
            muteBtn.setAttribute('aria-pressed', String(isOff));
        }

        async function toggleMobileAlwaysListeningFromHold() {
            mobileAlwaysListeningEnabled = !mobileAlwaysListeningEnabled;

            if (!mobileAlwaysListeningEnabled) {
                muted = true;
                if (window.alwaysListeningHotkeyMode && typeof toggleAlwaysListeningMode === 'function') {
                    await toggleAlwaysListeningMode();
                } else if (window.recognition && window.isListening) {
                    try { window.recognition.abort(); } catch (e) {}
                    window.isListening = false;
                }
                if (statusText) statusText.textContent = 'Always listening off';
            } else {
                muted = false;
                await ensureMobileListeningEnabled();
                if (statusText) statusText.textContent = 'Always listeningâ€¦';
            }

            updateMuteButtonUI();
        }

        function clearHoldToggleTimer() {
            if (holdToggleTimer) {
                clearTimeout(holdToggleTimer);
                holdToggleTimer = null;
            }
        }

        function startHoldToggleTimer(event) {
            if (!muteBtn) return;
            if (event && event.type === 'mousedown' && event.button !== 0) return;
            holdToggleTriggered = false;
            clearHoldToggleTimer();
            holdToggleTimer = setTimeout(function() {
                holdToggleTriggered = true;
                suppressNextMuteClick = true;
                toggleMobileAlwaysListeningFromHold();
            }, HOLD_TOGGLE_MS);
        }

        function stopHoldToggleTimer() {
            clearHoldToggleTimer();
        }

        // â”€â”€ Mute / unmute â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (muteBtn) {
            muteBtn.addEventListener('click', function() {
                if (suppressNextMuteClick || holdToggleTriggered) {
                    suppressNextMuteClick = false;
                    holdToggleTriggered = false;
                    return;
                }
                if (!mobileAlwaysListeningEnabled) {
                    if (statusText) statusText.textContent = 'Hold mic 3s to enable always listening';
                    return;
                }
                muted = !muted;
                updateMuteButtonUI();

                if (muted) {
                    // Pause recognition
                    if (window.alwaysListeningHotkeyMode && typeof toggleAlwaysListeningMode === 'function') {
                        toggleAlwaysListeningMode(); // turns it off
                    } else if (window.recognition && window.isListening) {
                        try { window.recognition.abort(); } catch(e) {}
                        window.isListening = false;
                    }
                } else {
                    // Resume always-listening
                    ensureMobileListeningEnabled();
                }
            });

            muteBtn.addEventListener('mousedown', startHoldToggleTimer);
            muteBtn.addEventListener('touchstart', startHoldToggleTimer, { passive: true });
            muteBtn.addEventListener('mouseup', stopHoldToggleTimer);
            muteBtn.addEventListener('mouseleave', stopHoldToggleTimer);
            muteBtn.addEventListener('touchend', stopHoldToggleTimer);
            muteBtn.addEventListener('touchcancel', stopHoldToggleTimer);
            muteBtn.addEventListener('pointercancel', stopHoldToggleTimer);
            muteBtn.addEventListener('contextmenu', function(event) { event.preventDefault(); });
        }

        // â”€â”€ Continue button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (continueBtn) {
            continueBtn.addEventListener('click', function() {
                if (typeof continueConversation === 'function') continueConversation();
            });
        }

        // â”€â”€ Chat / transcript toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function toggleTranscript() {
            transcriptCollapsed = !transcriptCollapsed;
            if (transcript) transcript.classList.toggle('collapsed', transcriptCollapsed);
            if (transcriptToggle) {
                transcriptToggle.setAttribute('aria-expanded', String(!transcriptCollapsed));
            }
        }

        if (chatBtn)          chatBtn.addEventListener('click', toggleTranscript);
        if (transcriptToggle) transcriptToggle.addEventListener('click', toggleTranscript);
        // Keyboard support for transcript header
        if (transcriptToggle) {
            transcriptToggle.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTranscript(); }
            });
        }

        // â”€â”€ Auto-start always-listening after voice system is ready â”€â”€â”€â”€â”€â”€â”€â”€
        async function ensureMobileListeningEnabled() {
            if (muted || !mobileAlwaysListeningEnabled) return;
            try {
                if (typeof window.requestVoicePermission === 'function' && !window.hasVoicePermission) {
                    const granted = await window.requestVoicePermission();
                    if (!granted) {
                        if (statusText) statusText.textContent = 'Microphone permission needed';
                        return;
                    }
                }

                if (typeof toggleAlwaysListeningMode === 'function') {
                    if (!window.alwaysListeningHotkeyMode) {
                        await toggleAlwaysListeningMode();
                    }
                    if (statusText) statusText.textContent = 'Always listeningâ€¦';
                    return;
                }

                if (typeof window.startListeningDirect === 'function' && !window.isListening) {
                    window.startListeningDirect();
                    if (statusText) statusText.textContent = 'Listeningâ€¦';
                }
            } catch (error) {
                console.warn('ðŸ“± Mobile listening enable failed:', error);
            }
        }

        updateMuteButtonUI();

        window.addEventListener('load', function() {
            // First attempt at 2 s, retry at 5 s if voice hasn't initialised yet
            setTimeout(ensureMobileListeningEnabled, 2000);
            setTimeout(ensureMobileListeningEnabled, 5000);
            setTimeout(ensureMobileListeningEnabled, 9000);
        });

        console.log('ðŸ“± Mobile call mode initialised');
    })();

