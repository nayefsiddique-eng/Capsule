document.addEventListener('DOMContentLoaded', () => {
  const BACKEND_URL = 'http://localhost:3001';

  // --- Auth View Elements ---
  const authView = document.getElementById('auth-view');
  const mainView = document.getElementById('main-view');
  const settingsView = document.getElementById('settings-view');
  const otpView = document.getElementById('otp-view'); // Added by HTML rewrite
  const forgotView = document.getElementById('forgot-view');
  
  const authMainForms = document.getElementById('auth-main-forms');
  const forgotLink = document.getElementById('forgot-password-link');
  const backToSignin = document.getElementById('back-to-signin');
  const forgotForm = document.getElementById('forgot-form');
  const forgotEmail = document.getElementById('forgot-email');
  const forgotStatus = document.getElementById('forgot-status');
  const forgotSubmit = document.getElementById('forgot-submit');
  
  const tabSignin = document.querySelector('.auth-tab[data-tab="signin"]');
  const tabSignup = document.querySelector('.auth-tab[data-tab="signup"]');
  const tabIndicator = document.querySelector('.tab-indicator');
  
  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const confirmInput = document.getElementById('auth-confirm');
  const nameInput = document.getElementById('auth-name');
  const rememberInput = document.getElementById('auth-remember-check');
  
  const btnText = document.querySelector('.btn-text');
  const spinner = document.querySelector('.spinner');
  
  const signupOnlyElements = document.querySelectorAll('.signup-only');
  const signinOnlyElements = document.querySelectorAll('.signin-only');
  
  const eyeToggle = document.querySelector('.eye-toggle');
  const strengthFill = document.getElementById('strength-fill');
  const strengthText = document.getElementById('strength-text');
  
  const skipAuthBtn = document.getElementById('skip-auth');
  const userAvatar = document.getElementById('user-avatar');

  // Inline Auth Error Element (Added in HTML rewrite)
  const authError = document.getElementById('auth-error');

  // --- OTP Elements (Added in HTML rewrite) ---
  const otpInputs = document.querySelectorAll('.otp-digit');
  const otpEmailDisplay = document.getElementById('otp-email-display');
  const otpResendBtn = document.getElementById('otp-resend');
  const otpTimerDisplay = document.getElementById('otp-countdown');
  const backToSignupBtn = document.getElementById('otp-back');
  let currentOtpEmail = '';
  let otpTimerInterval = null;

  // --- Settings View Elements ---
  const settingsBtn = document.getElementById('settings-btn');
  const settingsBackBtn = document.getElementById('settings-back-btn');
  const widgetToggle = document.getElementById('settings-widget-toggle');
  const taggingToggle = document.getElementById('settings-tagging-toggle');

  // --- Main Tray Elements ---
  const list = document.getElementById('capsule-list');
  const captureBtn = document.getElementById('capture-btn');
  const modalPreview = document.getElementById('modal-preview');
  const modalDiff = document.getElementById('modal-diff');
  
  let capsules = [];
  let draggedId = null;
  let currentTab = 'signin';
  let pendingAction = null; // 'merge' or 'diff'
  let actionSourceId = null;

  // --- AUTH LOGIC (JWT + BACKEND) ---

  async function checkSession() {
    chrome.storage.local.get(['sessionToken', 'guestMode'], async (result) => {
      if (result.guestMode) {
        showMainView({ name: 'Guest' });
        return;
      }

      if (result.sessionToken) {
        try {
          const res = await fetch(`${BACKEND_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${result.sessionToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            showMainView(data.user);
          } else {
            chrome.storage.local.remove('sessionToken', () => showAuthView());
          }
        } catch (err) {
          console.error('Auth verification failed:', err);
          showAuthView();
        }
      } else {
        showAuthView();
      }
    });
  }
  
  function showAuthView() {
    authView.style.display = 'flex';
    mainView.style.display = 'none';
    settingsView.style.display = 'none';
    if (otpView) otpView.style.display = 'none';
  }
  
  function showMainView(user) {
    authView.style.display = 'none';
    mainView.style.display = 'flex';
    settingsView.style.display = 'none';
    if (otpView) otpView.style.display = 'none';
    
    if (user && user.name) {
      userAvatar.textContent = user.name.charAt(0).toUpperCase();
      userAvatar.title = "Sign Out (" + user.name + ")";
    } else {
      userAvatar.textContent = "U";
      userAvatar.title = "Sign Out";
    }
    render();
  }

  function showInlineError(msg) {
    if (authError) {
      authError.textContent = msg;
      authError.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function hideInlineError() {
    if (authError) authError.style.display = 'none';
  }

  // --- FORGOT PASSWORD ---
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    authMainForms.style.display = 'none';
    forgotView.style.display = 'block';
  });

  backToSignin.addEventListener('click', (e) => {
    e.preventDefault();
    authMainForms.style.display = 'block';
    forgotView.style.display = 'none';
    forgotStatus.style.display = 'none';
    forgotEmail.value = '';
  });

  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!forgotEmail.value.includes('@')) {
      showError(forgotEmail);
      return;
    }
    
    const submitBtnText = forgotSubmit.querySelector('.btn-text');
    const submitSpinner = forgotSubmit.querySelector('.spinner');
    
    submitBtnText.style.display = 'none';
    submitSpinner.style.display = 'block';
    
    try {
      const res = await fetch(`${BACKEND_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.value })
      });
      const data = await res.json();
      
      submitBtnText.style.display = 'block';
      submitSpinner.style.display = 'none';

      if (res.ok) {
        forgotStatus.style.display = 'block';
        forgotStatus.textContent = data.message;
        setTimeout(() => {
          showOTPView(forgotEmail.value);
        }, 1500);
      } else {
        alert(data.error || 'Failed to send reset link');
      }
    } catch (err) {
      submitBtnText.style.display = 'block';
      submitSpinner.style.display = 'none';
      alert('Network error. Is the backend running?');
    }
  });

  // --- TABS ---
  function switchTab(tab) {
    currentTab = tab;
    hideInlineError();
    if (tab === 'signin') {
      tabSignin.classList.add('active');
      tabSignup.classList.remove('active');
      tabIndicator.style.transform = 'translateX(0)';
      btnText.textContent = 'Sign In';
      
      signupOnlyElements.forEach(el => el.style.display = 'none');
      signinOnlyElements.forEach(el => el.style.display = 'flex');
    } else {
      tabSignup.classList.add('active');
      tabSignin.classList.remove('active');
      tabIndicator.style.transform = 'translateX(100%)';
      btnText.textContent = 'Sign Up';
      
      signupOnlyElements.forEach(el => {
        if(el.classList.contains('input-group')) el.style.display = 'flex';
        else el.style.display = 'flex';
      });
      signinOnlyElements.forEach(el => el.style.display = 'none');
    }
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  }

  tabSignin.addEventListener('click', () => switchTab('signin'));
  tabSignup.addEventListener('click', () => switchTab('signup'));

  // --- EYE TOGGLE ---
  eyeToggle.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeToggle.innerHTML = `
        <svg class="icon-hide" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      `;
    } else {
      passwordInput.type = 'password';
      eyeToggle.innerHTML = `
        <svg class="icon-show" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      `;
    }
  });

  // --- PASSWORD STRENGTH ---
  passwordInput.addEventListener('input', (e) => {
    if (currentTab !== 'signup') return;
    const val = e.target.value;
    let score = 0;
    if (val.length > 5) score++;
    if (val.length > 8) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
    
    if (val.length === 0) {
      strengthFill.style.width = '0%';
      strengthText.textContent = 'Weak';
    } else if (score === 1) {
      strengthFill.style.width = '33%';
      strengthFill.style.backgroundColor = 'var(--danger)';
      strengthText.textContent = 'Weak';
    } else if (score === 2) {
      strengthFill.style.width = '66%';
      strengthFill.style.backgroundColor = '#fbbf24'; // amber
      strengthText.textContent = 'Medium';
    } else if (score >= 3) {
      strengthFill.style.width = '100%';
      strengthFill.style.backgroundColor = 'var(--success)';
      strengthText.textContent = 'Strong';
    }
  });

  // --- FORM SUBMISSION ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideInlineError();
    
    let isValid = true;
    
    if (!emailInput.value.includes('@')) {
      showError(emailInput);
      isValid = false;
    }
    if (passwordInput.value.length < 6) {
      showError(passwordInput);
      isValid = false;
    }
    if (currentTab === 'signup') {
      if (nameInput.value.trim() === '') {
        showError(nameInput);
        isValid = false;
      }
      if (passwordInput.value !== confirmInput.value) {
        showError(confirmInput);
        isValid = false;
      }
    }
    
    if (!isValid) return;
    
    btnText.style.display = 'none';
    spinner.style.display = 'block';

    try {
      if (currentTab === 'signup') {
        const res = await fetch(`${BACKEND_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value
          })
        });
        const data = await res.json();
        if (res.ok) {
          showOTPView(emailInput.value.trim());
        } else {
          showInlineError(data.error || 'Registration failed');
        }
      } else {
        const res = await fetch(`${BACKEND_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailInput.value.trim(),
            password: passwordInput.value
          })
        });
        const data = await res.json();
        if (res.ok) {
          chrome.storage.local.set({ sessionToken: data.token, guestMode: false }, () => {
            showMainView(data.user);
          });
        } else {
          if (data.error && data.error.includes('verified')) {
            // Re-send OTP if unverified
            await fetch(`${BACKEND_URL}/auth/send-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailInput.value.trim() })
            });
            showOTPView(emailInput.value.trim());
          } else {
            showInlineError(data.error || 'Login failed');
          }
        }
      }
    } catch (err) {
      console.error(err);
      showInlineError('Network error. Is the backend server running?');
    } finally {
      btnText.style.display = 'block';
      spinner.style.display = 'none';
    }
  });
  
  function showError(inputEl) {
    inputEl.classList.remove('shake');
    void inputEl.offsetWidth;
    inputEl.classList.add('error', 'shake');
    setTimeout(() => inputEl.classList.remove('shake'), 400);
  }
  
  [emailInput, passwordInput, confirmInput, nameInput, forgotEmail].forEach(el => {
    if(el) el.addEventListener('input', () => el.classList.remove('error'));
  });

  // --- OTP VIEW LOGIC ---
  function showOTPView(email) {
    if (!otpView) return;
    currentOtpEmail = email;
    if (otpEmailDisplay) otpEmailDisplay.textContent = email;
    authView.style.display = 'none';
    forgotView.style.display = 'none';
    otpView.style.display = 'flex';
    
    // Reset inputs
    otpInputs.forEach(i => i.value = '');
    if (otpInputs.length > 0) otpInputs[0].focus();
    
    startOTPTimer();
  }

  function startOTPTimer() {
    clearInterval(otpTimerInterval);
    let seconds = 300; // 5 mins
    otpResendBtn.style.pointerEvents = 'none';
    otpResendBtn.style.opacity = '0.5';
    
    otpTimerInterval = setInterval(() => {
      seconds--;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      if (otpTimerDisplay) {
        otpTimerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      }
      
      if (seconds <= 0) {
        clearInterval(otpTimerInterval);
        if (otpTimerDisplay) otpTimerDisplay.textContent = '0:00';
        otpResendBtn.style.pointerEvents = 'auto';
        otpResendBtn.style.opacity = '1';
      }
    }, 1000);
  }

  if (otpInputs) {
    otpInputs.forEach((input, i) => {
      input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && i < otpInputs.length - 1) {
          otpInputs[i + 1].focus();
        }
        checkOTPSubmit();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
          otpInputs[i - 1].focus();
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        [...pasted].forEach((char, index) => {
          if (otpInputs[index]) {
            otpInputs[index].value = char;
            if (index < otpInputs.length - 1) otpInputs[index + 1].focus();
          }
        });
        checkOTPSubmit();
      });
    });
  }

  async function checkOTPSubmit() {
    const code = Array.from(otpInputs).map(i => i.value).join('');
    if (code.length === 6) {
      // Auto submit
      otpInputs.forEach(i => i.disabled = true);
      try {
        const res = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentOtpEmail, otp: code })
        });
        const data = await res.json();
        if (res.ok) {
          chrome.storage.local.set({ sessionToken: data.token, guestMode: false }, () => {
            showMainView(data.user);
          });
        } else {
          alert(data.error || 'Invalid code');
          otpInputs.forEach(i => i.disabled = false);
          otpInputs.forEach(i => i.value = '');
          otpInputs[0].focus();
        }
      } catch (err) {
        alert('Network error verifying OTP');
        otpInputs.forEach(i => i.disabled = false);
      }
    }
  }

  if (otpResendBtn) {
    otpResendBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch(`${BACKEND_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentOtpEmail })
        });
        startOTPTimer();
        alert('New code sent!');
      } catch (err) {
        alert('Failed to send new code');
      }
    });
  }

  if (backToSignupBtn) {
    backToSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearInterval(otpTimerInterval);
      otpView.style.display = 'none';
      authView.style.display = 'flex';
      switchTab('signup');
    });
  }

  // --- GUEST & SIGN OUT ---
  skipAuthBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.storage.local.set({ guestMode: true }, () => showMainView({ name: 'Guest' }));
  });
  
  userAvatar.addEventListener('click', () => {
    chrome.storage.local.remove(['sessionToken', 'guestMode'], () => {
      showAuthView();
    });
  });

  // --- SETTINGS LOGIC ---
  settingsBtn.addEventListener('click', () => {
    mainView.style.display = 'none';
    settingsView.style.display = 'flex';
    chrome.storage.local.get(['showWidget', 'enableAutoTagging'], (res) => {
      widgetToggle.checked = res.showWidget !== false;
      taggingToggle.checked = res.enableAutoTagging !== false;
    });
  });

  settingsBackBtn.addEventListener('click', () => {
    checkSession(); // Return to main view (or auth if session died)
  });

  widgetToggle.addEventListener('change', () => {
    chrome.storage.local.set({ showWidget: widgetToggle.checked });
  });

  taggingToggle.addEventListener('change', () => {
    chrome.storage.local.set({ enableAutoTagging: taggingToggle.checked });
  });

  // --- MAIN TRAY LOGIC ---
  function render() {
    chrome.storage.local.get(['savedCapsules'], (result) => {
      capsules = result.savedCapsules || [];
      list.innerHTML = '';
      
      if (pendingAction) {
        const banner = document.createElement('div');
        banner.style.padding = '8px';
        banner.style.backgroundColor = 'var(--accent-light)';
        banner.style.color = 'var(--accent)';
        banner.style.border = '1px solid var(--accent)';
        banner.style.borderRadius = '4px';
        banner.style.textAlign = 'center';
        banner.style.fontFamily = "'JetBrains Mono', monospace";
        banner.style.fontSize = '0.8rem';
        banner.innerHTML = `Select a capsule to ${pendingAction} with <a href="#" id="cancel-action" style="color:var(--text-primary);margin-left:8px">Cancel</a>`;
        list.appendChild(banner);

        setTimeout(() => {
          document.getElementById('cancel-action').addEventListener('click', (e) => {
            e.preventDefault();
            pendingAction = null;
            actionSourceId = null;
            render();
          });
        }, 0);
      }

      if (capsules.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
            </svg>
            <div>No capsules yet.<br>Capture a chat to get started!</div>
          </div>
        `;
        return;
      }
      
      capsules.forEach((c) => {
        const el = document.createElement('div');
        el.className = 'capsule';
        el.draggable = !pendingAction;
        el.dataset.id = c.id;
        
        if (pendingAction && c.id === actionSourceId) {
          el.style.opacity = '0.5';
          el.style.pointerEvents = 'none';
        }

        if (pendingAction && c.id !== actionSourceId) {
          el.style.cursor = 'pointer';
          el.style.borderColor = 'var(--accent)';
          el.addEventListener('mouseenter', () => el.style.backgroundColor = 'var(--accent-light)');
          el.addEventListener('mouseleave', () => el.style.backgroundColor = 'var(--bg-surface)');
        }
        
        el.innerHTML = `
          <div class="capsule-header">
            <div class="capsule-title">${c.title}</div>
            <div class="site-badge">${c.sourceSite}</div>
          </div>
          <div class="capsule-meta">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
            ${c.turns.length} turns
          </div>
          <div class="tags">
            ${c.tags.map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
          ${pendingAction ? '' : `
          <div class="actions" style="position: absolute; right: 16px; bottom: 16px;">
            <button class="action-btn" title="Copy" onclick="event.stopPropagation(); window.copyCapsule('${c.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H88A16,16,0,0,0,72,56V72H56A16,16,0,0,0,40,88V216a16,16,0,0,0,16,16H168a16,16,0,0,0,16-16V200h32a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm-48,176H56V88H168Z"></path></svg>
            </button>
            <button class="action-btn danger" title="Delete" onclick="event.stopPropagation(); window.deleteCapsule('${c.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM192,208H64V64H192Z"></path></svg>
            </button>
          </div>
          `}
        `;
        
        if (!pendingAction) {
          el.addEventListener('dragstart', (e) => {
            draggedId = c.id;
            document.body.classList.add('is-dragging');
            setTimeout(() => el.classList.add('dragging'), 0);
          });
          el.addEventListener('dragend', () => {
            document.body.classList.remove('is-dragging');
            el.classList.remove('dragging');
            draggedId = null;
          });
          el.addEventListener('click', () => showPreview(c));
        } else {
          el.addEventListener('click', () => {
            if (c.id !== actionSourceId) {
              const sourceCap = capsules.find(cap => cap.id === actionSourceId);
              if (pendingAction === 'merge') {
                performMerge(sourceCap, c);
              } else if (pendingAction === 'diff') {
                showDiff(sourceCap, c);
              }
              pendingAction = null;
              actionSourceId = null;
              render();
            }
          });
        }
        
        list.appendChild(el);
      });
    });
  }

  function generateTags(turns, autoTaggingEnabled) {
    if (autoTaggingEnabled === false) return ['General'];
    const text = turns.map(t => t.content).join(' ').toLowerCase();
    const tags = [];
    if (text.includes('function') || text.includes('const') || text.includes('console.log')) tags.push('Code');
    if (text.includes('error') || text.includes('bug') || text.includes('fix')) tags.push('Debugging');
    if (text.includes('idea') || text.includes('what if') || text.includes('brainstorm')) tags.push('Brainstorming');
    if (tags.length === 0) tags.push('General');
    return tags.slice(0, 2);
  }

  captureBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_CHAT' }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Could not connect to the page. Is it a supported AI site?');
        return;
      }
      if (response && response.success && response.turns.length > 0) {
        const hostname = new URL(tab.url).hostname;
        const siteName = hostname.includes('chatgpt') ? 'ChatGPT' : 
                         hostname.includes('claude') ? 'Claude' :
                         hostname.includes('gemini') ? 'Gemini' :
                         hostname.includes('perplexity') ? 'Perplexity' : 'Unknown';
        
        chrome.storage.local.get(['enableAutoTagging'], (res) => {
          const capsule = {
            id: crypto.randomUUID(),
            sourceSite: siteName,
            capturedAt: Date.now(),
            title: response.turns[0]?.content.substring(0, 30) + '...' || 'New Chat',
            turns: response.turns,
            tags: generateTags(response.turns, res.enableAutoTagging)
          };
          
          capsules.push(capsule);
          chrome.storage.local.set({ savedCapsules: capsules, activeCapsule: capsule }, () => {
            render();
          });
        });
      } else {
        alert('No conversation turns found.');
      }
    });
  });

  window.deleteCapsule = (id) => {
    capsules = capsules.filter(c => c.id !== id);
    chrome.storage.local.set({ savedCapsules: capsules }, render);
  };
  window.copyCapsule = (id) => {
    const c = capsules.find(c => c.id === id);
    if (!c) return;
    const text = c.turns.map(t => `${t.role.toUpperCase()}:\n${t.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  function showPreview(c) {
    document.getElementById('modal-title').textContent = c.title;
    const content = document.getElementById('modal-content');
    content.innerHTML = c.turns.map(t => `
      <div class="chat-turn chat-${t.role}">
        <strong>${t.role.toUpperCase()}</strong><br/>
        ${t.content.replace(/\n/g, '<br/>')}
      </div>
    `).join('');
    modalPreview.classList.add('active');
  }
  
  document.getElementById('modal-close-preview').addEventListener('click', () => {
    modalPreview.classList.remove('active');
  });
  document.getElementById('modal-close-diff').addEventListener('click', () => {
    modalDiff.classList.remove('active');
  });

  const zones = document.querySelectorAll('.drop-zone');
  zones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      
      const targetZone = zone.id;
      if (draggedId && capsules.length > 1) {
        pendingAction = targetZone === 'zone-merge' ? 'merge' : 'diff';
        actionSourceId = draggedId;
        render();
      } else if (capsules.length <= 1) {
        alert('Need at least 2 capsules to perform this action.');
      }
    });
  });

  function performMerge(c1, c2) {
    const merged = {
      id: crypto.randomUUID(),
      sourceSite: 'Merged',
      capturedAt: Date.now(),
      title: `Merged: ${c1.title.substring(0, 15)} & ${c2.title.substring(0, 15)}`,
      turns: [...c1.turns, ...c2.turns],
      tags: ['Merged']
    };
    capsules.push(merged);
    chrome.storage.local.set({ savedCapsules: capsules }, render);
  }

  function showDiff(c1, c2) {
    const content = document.getElementById('modal-diff-content');
    const len1 = c1.turns.length;
    const len2 = c2.turns.length;
    
    let html = `<div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-secondary)">Comparing <b>${c1.sourceSite}</b> (${len1} turns) with <b>${c2.sourceSite}</b> (${len2} turns)</div>`;
    
    const maxLen = Math.max(len1, len2);
    for(let i=0; i<maxLen; i++) {
      if (c1.turns[i] && c2.turns[i]) {
        if (c1.turns[i].content === c2.turns[i].content) {
          html += `<div class="diff-line">${c1.turns[i].content.substring(0,50)}... (Match)</div>`;
        } else {
          html += `<div class="diff-line diff-remove">- ${c1.turns[i].content.substring(0,80)}...</div>`;
          html += `<div class="diff-line diff-add">+ ${c2.turns[i].content.substring(0,80)}...</div>`;
        }
      } else if (c1.turns[i]) {
        html += `<div class="diff-line diff-remove">- ${c1.turns[i].content.substring(0,80)}...</div>`;
      } else if (c2.turns[i]) {
        html += `<div class="diff-line diff-add">+ ${c2.turns[i].content.substring(0,80)}...</div>`;
      }
    }
    
    content.innerHTML = html;
    modalDiff.classList.add('active');
  }

  // Init
  checkSession();
});
