document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // >> PASTE YOUR COPIED firebaseConfig OBJECT FROM FIREBASE HERE <<
    const firebaseConfig = {
        apiKey: "AIzaSyDLYmTbVe53J1nzH3dl5OCgGnODesmsWpQ",
        authDomain: "urban-palate-app.firebaseapp.com",
        projectId: "urban-palate-app",
        storageBucket: "urban-palate-app.firebasestorage.app",
        messagingSenderId: "688481428327",
        appId: "1:688481428327:web:b842d6c99faa84132785c2"
      };
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // --- Initialize Firebase (Using v9 Compat) ---
    let app; let db; let auth;
    try {
        if (!firebase.apps.length) { app = firebase.initializeApp(firebaseConfig); }
        else { app = firebase.app(); }
        db = firebase.firestore(); auth = firebase.auth();
        console.log("Firebase Initialized (v9 Compat SDK).");
    } catch (error) { console.error("Firebase initialization failed:", error); alert("CRITICAL: Firebase initialization failed."); return; }

    // --- Global State & Cache ---
    let menuCache = []; let cart = JSON.parse(localStorage.getItem('foodOrderCart')) || [];
    let toastTimeout; let currentFirebaseUser = null;
    let confirmationResult = null; let appVerifier = null; // Phone Auth

    // --- UI Elements ---
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const logoutButton = document.getElementById('logout-button');
    const userInfoDiv = document.getElementById('user-info');
    const userEmailSpan = document.getElementById('user-email-display');
    const mainNav = document.getElementById('main-nav');
    const headerActions = document.querySelector('.header-actions');
    const googleSignInButtons = document.querySelectorAll('#google-signin-button');
    const phoneSignInTriggerButton = document.getElementById('phone-signin-trigger-button');
    const phoneAuthSection = document.getElementById('phone-auth-section');
    const phoneSendCodeForm = document.getElementById('phone-send-code-form');
    const phoneVerifyCodeForm = document.getElementById('phone-verify-code-form');
    const phoneNumberInput = document.getElementById('phone-number');
    const verificationCodeInput = document.getElementById('verification-code');
    const recaptchaContainer = document.getElementById('recaptcha-container');
    const cancelPhoneAuthButton = document.getElementById('cancel-phone-auth-button');
    const authErrorDivLogin = loginForm?.querySelector('#auth-error');
    const authErrorDivSignup = signupForm?.querySelector('#auth-error');
    const authErrorDivPhone = authErrorDivLogin; // Reuse login error div for phone

    // --- AUTHENTICATION LOGIC ---

    auth.onAuthStateChanged(user => {
        currentFirebaseUser = user;
        if (user) {
            console.log("Auth State Changed: User logged in:", user.uid, user.providerData[0]?.providerId || user.email || user.phoneNumber);
            updateUIForLoggedInUser(user.email || user.phoneNumber || 'Logged In User');
            if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
                window.location.replace('index.html');
            } else {
                initializePageContent();
            }
        } else {
            console.log("Auth State Changed: User logged out.");
            updateUIForLoggedOutUser();
            if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('signup.html')) {
                 window.location.replace('login.html');
            }
        }
    });

    // ** Login Handler (Email/Password) **
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const email = loginForm['login-email'].value.trim(); const password = loginForm['login-password'].value;
            const submitButton = loginForm.querySelector('button[type="submit"]'); toggleButtonLoading(submitButton, true); hideAuthError(authErrorDivLogin);
            try { await auth.signInWithEmailAndPassword(email, password); } catch (error) { console.error("Login failed:", error); showAuthError(authErrorDivLogin, error); toggleButtonLoading(submitButton, false); }
        });
    }

    // ** Signup Handler (Email/Password) **
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const email = signupForm['signup-email'].value.trim(); const password = signupForm['signup-password'].value;
            const submitButton = signupForm.querySelector('button[type="submit"]'); toggleButtonLoading(submitButton, true); hideAuthError(authErrorDivSignup);
            if (password.length < 6) { showAuthError(authErrorDivSignup, { code: 'auth/weak-password' }); toggleButtonLoading(submitButton, false); return; }
            try { await auth.createUserWithEmailAndPassword(email, password); } catch (error) { console.error("Signup failed:", error); showAuthError(authErrorDivSignup, error); toggleButtonLoading(submitButton, false); }
        });
    }

     // ** Google Sign-in Handler **
     googleSignInButtons.forEach(button => {
         button?.addEventListener('click', async () => {
             const currentErrorDiv = button.closest('.auth-container')?.querySelector('#auth-error'); hideAuthError(currentErrorDiv); const provider = new firebase.auth.GoogleAuthProvider();
             try { await auth.signInWithPopup(provider); } catch (error) { console.error("Google Sign-in failed:", error); showAuthError(currentErrorDiv, error); }
         });
     });


    // ** Phone Sign-in - Step 0: Trigger UI **
    if (phoneSignInTriggerButton) {
        phoneSignInTriggerButton.addEventListener('click', () => {
            hideAuthError(authErrorDivPhone); if (loginForm) loginForm.style.display = 'none';
            const googleBtnOnLogin = loginForm?.closest('.auth-container')?.querySelector('#google-signin-button'); if (googleBtnOnLogin) googleBtnOnLogin.style.display = 'none';
            phoneSignInTriggerButton.style.display = 'none'; if (phoneAuthSection) phoneAuthSection.style.display = 'block';
            if (phoneSendCodeForm) phoneSendCodeForm.style.display = 'block'; if (phoneVerifyCodeForm) phoneVerifyCodeForm.style.display = 'none';
            if (recaptchaContainer) recaptchaContainer.style.display = 'flex'; // Ensure visible
            setupRecaptchaVerifier();
        });
    }
     if (cancelPhoneAuthButton) {
        cancelPhoneAuthButton.addEventListener('click', () => {
            hideAuthError(authErrorDivPhone); if (loginForm) loginForm.style.display = 'block';
            const googleBtnOnLogin = loginForm?.closest('.auth-container')?.querySelector('#google-signin-button'); if (googleBtnOnLogin) googleBtnOnLogin.style.display = 'block';
            if (phoneSignInTriggerButton) phoneSignInTriggerButton.style.display = 'block'; if (phoneAuthSection) phoneAuthSection.style.display = 'none';
            if(recaptchaContainer) recaptchaContainer.innerHTML = '';
            if(appVerifier) { try { appVerifier.clear(); } catch(e){} appVerifier = null; } confirmationResult = null;
            const sendCodeBtn = phoneSendCodeForm?.querySelector('button[type="submit"]'); if(sendCodeBtn) toggleButtonLoading(sendCodeBtn, false);
            const verifyCodeBtn = phoneVerifyCodeForm?.querySelector('button[type="submit"]'); if(verifyCodeBtn) toggleButtonLoading(verifyCodeBtn, false);
        });
    }

     // ** Phone Sign-in - Step 1: Setup reCAPTCHA **
     function setupRecaptchaVerifier() {
        if (!recaptchaContainer || window.getComputedStyle(recaptchaContainer).display === 'none') { return; }
        if (appVerifier) { if (recaptchaContainer.innerHTML === '') { appVerifier.render().catch(e => console.error("Error re-rendering reCAPTCHA", e)); } return; }
        console.log("Setting up reCAPTCHA verifier..."); hideAuthError(authErrorDivPhone); recaptchaContainer.innerHTML = '';
        try {
            appVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { // Use firebase.auth() for v9 compat
                'size': 'normal', 'callback': () => console.log("reCAPTCHA solved"),
                'expired-callback': () => { console.log("reCAPTCHA expired."); showAuthError(authErrorDivPhone, { message: "reCAPTCHA expired. Try again." }); if(appVerifier) { try { appVerifier.clear(); } catch(e){} } appVerifier = null; setupRecaptchaVerifier(); }
            }, auth); // Pass auth instance
            appVerifier.render().then(widgetId => { console.log("reCAPTCHA rendered:", widgetId); window.recaptchaWidgetId = widgetId; }).catch(error => { console.error("Error rendering reCAPTCHA:", error); showAuthError(authErrorDivPhone, {message: "Could not render reCAPTCHA."}); appVerifier = null; });
        } catch (error) { console.error("Error creating RecaptchaVerifier:", error); showAuthError(authErrorDivPhone, {message: "Failed phone verification init."}); }
     }


    // ** Phone Sign-in - Step 2: Send Code **
    if (phoneSendCodeForm) {
        phoneSendCodeForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const phoneNumber = phoneNumberInput.value.trim(); const submitButton = phoneSendCodeForm.querySelector('button[type="submit"]'); hideAuthError(authErrorDivPhone);
            if (!appVerifier) { showAuthError(authErrorDivPhone, { message: "Complete reCAPTCHA first." }); setupRecaptchaVerifier(); return; }
            if (!/^\+[1-9]\d{9,14}$/.test(phoneNumber)) { showAuthError(authErrorDivPhone, { message: "Enter valid phone (+country code)." }); return; }
            toggleButtonLoading(submitButton, true);
            try {
                console.log("Sending phone code to:", phoneNumber);
                confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, appVerifier); // v9 compat still uses auth directly here
                console.log("Verification code sent."); showToast(`Code sent to ${phoneNumber}`, 'success');
                phoneSendCodeForm.style.display = 'none'; if (phoneVerifyCodeForm) phoneVerifyCodeForm.style.display = 'block'; if (verificationCodeInput) verificationCodeInput.focus();
                // Keep reCAPTCHA container in DOM but maybe hide visually if desired, or leave it for reset scenarios
                // if (recaptchaContainer) recaptchaContainer.style.display = 'none';
            } catch (error) {
                 console.error("Error sending phone code:", error); showAuthError(authErrorDivPhone, error);
                 if(appVerifier) { try { appVerifier.clear(); } catch(e){} } appVerifier = null; setupRecaptchaVerifier(); // Reset fully on error
            } finally { toggleButtonLoading(submitButton, false); }
        });
    }

    // ** Phone Sign-in - Step 3: Verify Code **
    if (phoneVerifyCodeForm) {
        phoneVerifyCodeForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const code = verificationCodeInput.value.trim(); const submitButton = phoneVerifyCodeForm.querySelector('button[type="submit"]'); hideAuthError(authErrorDivPhone);
            if (!confirmationResult) { showAuthError(authErrorDivPhone, { message: "Verification error. Send code again." }); return; }
            if (!code || code.length !== 6) { showAuthError(authErrorDivPhone, { message: "Enter the 6-digit code." }); return; }
            toggleButtonLoading(submitButton, true);
            try {
                 console.log("Verifying code:", code); await confirmationResult.confirm(code);
                 console.log("Phone verified! Observer handles login.");
                 confirmationResult = null; if(appVerifier) { try { appVerifier.clear(); } catch(e){} } appVerifier = null; if(recaptchaContainer) recaptchaContainer.innerHTML = ''; // Clear reCAPTCHA visually
             } catch (error) { console.error("Error verifying code:", error); showAuthError(authErrorDivPhone, error); toggleButtonLoading(submitButton, false); }
        });
    }


    // ** Logout Handler **
    if (logoutButton) { logoutButton.addEventListener('click', async () => { try { console.log("Logging out..."); await auth.signOut(); console.log("Logout successful."); } catch (error) { console.error("Logout failed:", error); showToast("Logout failed.", "error"); } }); }

    // --- Helper Functions ---
     function toggleButtonLoading(button, isLoading) { const btnTxt = button?.querySelector('.button-text'); const btnLoad = button?.querySelector('.button-loader'); if(button){ button.disabled = isLoading; } if(isLoading){ if(btnLoad) btnLoad.style.display='inline-block'; if(btnTxt) btnTxt.style.opacity='0'; } else { if(btnLoad) btnLoad.style.display='none'; if(btnTxt) btnTxt.style.opacity='1'; } }
     function showAuthError(errorDiv, error) { if(errorDiv) { errorDiv.textContent = getFirebaseErrorMessage(error); errorDiv.style.display = 'block'; } }
     function hideAuthError(errorDiv) { if(errorDiv) { errorDiv.textContent = ''; errorDiv.style.display = 'none'; } }
     function getFirebaseErrorMessage(error) { switch (error.code) { case 'auth/user-not-found': case 'auth/wrong-password': return 'Incorrect email or password.'; case 'auth/invalid-email': return 'Please enter a valid email address.'; case 'auth/email-already-in-use': return 'This email address is already registered.'; case 'auth/weak-password': return 'Password must be at least 6 characters.'; case 'auth/network-request-failed': return 'Network error. Check connection.'; case 'auth/too-many-requests': return 'Too many attempts. Please try again later.'; case 'auth/invalid-verification-code': return 'Invalid verification code.'; case 'auth/captcha-check-failed': case 'auth/invalid-verification-id': return 'Verification failed. Please try sending the code again.'; case 'auth/invalid-phone-number': return 'Invalid phone number format.'; case 'auth/missing-phone-number': return 'Phone number is missing.'; case 'auth/quota-exceeded': return 'SMS quota exceeded. Try again later.'; case 'auth/cancelled-popup-request': case 'auth/popup-closed-by-user': return 'Sign-in process cancelled.'; default: console.error("Unhandled Auth Error:", error); return 'An unexpected error occurred. Please try again.'; } }

    // --- UI UPDATE FUNCTIONS ---
     function updateUIForLoggedInUser(displayName) { if (userInfoDiv) { userInfoDiv.style.display = 'flex'; if(userEmailSpan) userEmailSpan.textContent = displayName || 'User'; } document.querySelectorAll('.auth-switch').forEach(el => el.style.display = 'none'); if (mainNav) mainNav.style.display = 'flex'; if (headerActions) headerActions.style.display = 'flex'; document.body.classList.add('logged-in'); document.body.classList.remove('logged-out'); }
     function updateUIForLoggedOutUser() { if (userInfoDiv) userInfoDiv.style.display = 'none'; if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) { document.querySelectorAll('.auth-switch').forEach(el => el.style.display = 'block'); } document.body.classList.add('logged-out'); document.body.classList.remove('logged-in'); }

    // --- CART MANAGEMENT ---
     function saveCart() { localStorage.setItem('foodOrderCart', JSON.stringify(cart)); updateCartCountDisplay(); if (document.getElementById('cart-items-container')) displayCartItems(); }
     function showToast(message, type = 'info') { const el = document.getElementById('toast-notification'); if (!el) return; el.textContent = message; el.className = 'toast show'; if (type === 'success') el.classList.add('success'); else if (type === 'error') el.classList.add('error'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { el.className = 'toast'; }, 3500); }
     function addToCart(itemId, btn) { const item = menuCache.find(i => i.id === itemId); if (!item) { showToast("Error: Item not found.", "error"); return; } const origHTML = btn.innerHTML; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Adding...`; btn.disabled = true; setTimeout(() => { const idx = cart.findIndex(i => i.id === itemId); if (idx > -1) cart[idx].quantity++; else cart.push({ ...item, quantity: 1 }); saveCart(); showToast(`${item.name} added!`, 'success'); btn.innerHTML = `<i class="fas fa-check"></i> Added!`; setTimeout(() => { btn.innerHTML = `<i class="fas fa-cart-plus"></i> Add to Cart`; btn.disabled = false; }, 1500); }, 100); }
     function updateQuantity(itemId, change) { const idx = cart.findIndex(i => i.id === itemId); if (idx > -1) { const item = cart[idx]; item.quantity += change; if (item.quantity <= 0) removeFromCart(itemId); else { const qtySpan = document.querySelector(`.cart-item [data-id="${itemId}"].decrease-qty`)?.parentElement.querySelector('.item-quantity'); if (qtySpan) qtySpan.textContent = item.quantity; const priceSpan = document.querySelector(`.cart-item [data-id="${itemId}"].decrease-qty`)?.closest('.cart-item').querySelector('.item-price'); if (priceSpan && item.price) priceSpan.textContent = formatCurrency(item.price * item.quantity); saveCart(); } } }
     function removeFromCart(itemId) { const idx = cart.findIndex(i => i.id === itemId); if (idx > -1) { const item = cart[idx]; const el = document.querySelector(`.cart-item [data-id="${itemId}"]`)?.closest('.cart-item'); if (el) { el.style.transition='opacity .3s, transform .3s'; el.style.opacity='0'; el.style.transform='translateX(-20px)'; setTimeout(() => { cart.splice(idx, 1); showToast(`${item.name} removed.`, 'info'); saveCart(); }, 300); } else { cart.splice(idx, 1); showToast(`${item.name} removed.`, 'info'); saveCart(); } } }
     function formatCurrency(amount) { return `₹${amount.toFixed(2)}`; }
     function calculateCartTotal() { return cart.reduce((t, i) => t + (i.price * i.quantity), 0); }
     function getCartItemCount() { return cart.reduce((t, i) => t + i.quantity, 0); }
     function updateCartCountDisplay() { const count = getCartItemCount(); const el = document.getElementById('cart-count-display'); if (el) el.textContent = count; }

    // --- PAGE SPECIFIC LOGIC ---
    async function fetchAndDisplayMenu() { if (!currentFirebaseUser) return; const c=document.getElementById('menu-items-container'); if(!c) return; c.innerHTML='<p>Loading menu...</p>'; try { const snap=await db.collection('menu_items').orderBy('name').get(); if(snap.empty){ c.innerHTML='<p>Menu unavailable.</p>'; menuCache=[]; return; } menuCache=[]; c.innerHTML=''; snap.forEach(doc=>{const i={id:doc.id,...doc.data()}; menuCache.push(i); const n=i.name||'[No Name]', d=i.description||'', a=`Add ${n} to cart`; const el=document.createElement('article'); el.className='menu-item'; el.setAttribute('aria-labelledby',`i-t-${i.id}`); el.innerHTML=`<div class="menu-item-image-container"><img src="${i.image||'placeholder-default.jpg'}" alt="${n}"></div><div class="menu-item-content"><h3 id="i-t-${i.id}">${n}</h3><p class="description">${d}</p><p class="price">${formatCurrency(i.price)}</p><button class="add-to-cart-btn" data-id="${i.id}" aria-label="${a}"><i class="fas fa-cart-plus"></i> Add to Cart</button></div>`; c.appendChild(el); }); if(!c.getAttribute('data-listener-menu')){ c.addEventListener('click',(e)=>{const b=e.target.closest('.add-to-cart-btn'); if(b&&!b.disabled){ addToCart(b.dataset.id, b); }}); c.setAttribute('data-listener-menu','true');} } catch(e){ console.error("Error fetching menu:",e); c.innerHTML='<p>Failed menu load.</p>'; showToast("Error loading menu.", "error");} }
    function displayCartItems() { if (!currentFirebaseUser) return; const c=document.getElementById('cart-items-container'), s=document.getElementById('cart-summary'), e=document.getElementById('empty-cart-message'), k=document.getElementById('checkout-button'); if (!c) return; const p=window.scrollY; c.innerHTML=''; const t=calculateCartTotal(), l=c.getAttribute('data-listener-attached'); if(cart.length>0 && !l){ c.addEventListener('click', handleCartActions); c.setAttribute('data-listener-attached','true'); } else if(cart.length===0 && l){ c.removeEventListener('click', handleCartActions); c.removeAttribute('data-listener-attached'); } if (cart.length===0){ if(s)s.style.display='none'; if(e)e.style.display='block'; } else { if(s)s.style.display='block'; if(e)e.style.display='none'; cart.forEach(i => { const d=i.id, n=i.name||`Item ${d}`, rL=`Remove ${n}`, qL=`Qty for ${n}`, dL=`Decrease ${n}`, iL=`Increase ${n}`; const el=document.createElement('div'); el.className='cart-item'; el.setAttribute('aria-label',`Cart item: ${n}`); el.innerHTML=`<img src="${i.image||'placeholder-default.jpg'}" alt="${n}"><div class="cart-item-details"><h4>${n}</h4><div class="quantity-controls" role="group" aria-label="${qL}"><button class="quantity-change-btn decrease-qty" data-id="${d}" aria-label="${dL}">-</button><span class="item-quantity" aria-live="polite">${i.quantity}</span><button class="quantity-change-btn increase-qty" data-id="${d}" aria-label="${iL}">+</button></div></div><span class="item-price">${formatCurrency(i.price*i.quantity)}</span><button class="remove-button" data-id="${d}" aria-label="${rL}"><i class="fas fa-trash-alt"></i><span class="sr-only">Remove</span></button>`; c.appendChild(el); }); const tE=s?.querySelector('#cart-total'); if(tE)tE.textContent=formatCurrency(t); if(k){ k.disabled=false; k.onclick=()=>{window.location.href='checkout.html';}; } } requestAnimationFrame(()=>{window.scrollTo(0,p);}); }
    function handleCartActions(event) { const t=event.target, b=t.closest('button'); if(!b)return; const id=b.dataset.id; if(!id)return; if(b.classList.contains('decrease-qty'))updateQuantity(id,-1); else if(b.classList.contains('increase-qty'))updateQuantity(id,1); else if(b.classList.contains('remove-button'))removeFromCart(id); }
    function displayCheckoutDetails() { if (!currentFirebaseUser) return; const f=document.getElementById('checkout-form'); if (!f) return; const sM=document.getElementById('order-success-message'), pB=document.getElementById('place-order-button'), sD=document.getElementById('checkout-summary'), t=calculateCartTotal(), l=f.getAttribute('data-listener-attached'); if (cart.length===0){ f.style.display='none'; if(pB){pB.disabled=true; pB.innerHTML="Cart is Empty";} if(sD)sD.innerHTML="<p>Cart is empty.</p>"; if(l){f.removeEventListener('submit',handleCheckoutSubmit); f.removeAttribute('data-listener-attached');} return; } else { f.style.display='block'; if(pB){pB.disabled=false; pB.innerHTML='<i class="fas fa-check-circle"></i> Place Order (Simulated)';} if(sD){sD.style.display='block'; sD.innerHTML=`<p>Final Amount: <span id="checkout-total">${formatCurrency(t)}</span></p>`;} if(!l){f.addEventListener('submit',handleCheckoutSubmit); f.setAttribute('data-listener-attached','true');} } }
    async function handleCheckoutSubmit(event) { event.preventDefault(); if (!currentFirebaseUser) { showToast("Please log in.", "error"); return; } const f=event.target, pB=document.getElementById('place-order-button'), sD=document.getElementById('checkout-summary'), sM=document.getElementById('order-success-message'); let v=true; const rI=f.querySelectorAll('[required]'); f.querySelectorAll('.error-message').forEach(e=>e.remove()); rI.forEach(i=>{i.style.borderColor=''; i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby');}); rI.forEach(i=>{const g=i.closest('.form-group'); if(!i.value.trim()){v=false; i.style.borderColor='var(--danger-color)'; i.setAttribute('aria-invalid','true'); const eS=document.createElement('span'); eS.className='error-message'; const iId=i.id||`i-${Math.random().toString(16).slice(2)}`; i.id=iId; eS.id=`${iId}-error`; i.setAttribute('aria-describedby',eS.id); eS.textContent='Required.'; if(g)g.appendChild(eS);} }); if(!v){showToast('Please fill required fields.', 'error'); if(!f.getAttribute('data-listener-attached')){f.addEventListener('submit',handleCheckoutSubmit); f.setAttribute('data-listener-attached','true');} f.querySelector('[aria-invalid="true"]')?.focus(); return;} const tA=calculateCartTotal(), dI={name:f.name.value.trim(), address:f.address.value.trim(), phone:f.phone.value.trim()}, pM=f.payment.value, oI=cart.map(i=>({id:i.id, name:i.name, price:i.price, quantity:i.quantity})); const oD={userId:currentFirebaseUser.uid, userEmail:currentFirebaseUser.email, items:oI, deliveryInfo:dI, paymentMethod:pM, totalAmount:tA, status:"pending", createdAt:firebase.firestore.FieldValue.serverTimestamp()}; toggleButtonLoading(pB,true); f.removeEventListener('submit',handleCheckoutSubmit); f.removeAttribute('data-listener-attached'); try { const dR=await db.collection('orders').add(oD); console.log("Order saved ID:", dR.id); cart=[]; saveCart(); f.style.display='none'; if(sD)sD.style.display='none'; if(sM){sM.style.display='block'; sM.focus();} showToast('Order Placed!', 'success'); } catch(e){ console.error('Error saving order:',e); showToast(`Order failed: ${e.message||'Could not save.'}`,'error'); toggleButtonLoading(pB,false); if(!f.getAttribute('data-listener-attached')){f.addEventListener('submit',handleCheckoutSubmit); f.setAttribute('data-listener-attached','true');} } }

    // --- INITIALIZATION ---
    function initializePageContent() { console.log("Initializing page content..."); if(!currentFirebaseUser) return; updateCartCountDisplay(); if (document.getElementById('menu-items-container')) fetchAndDisplayMenu(); if (document.getElementById('cart-items-container')) displayCartItems(); if (document.getElementById('checkout-form')) displayCheckoutDetails(); }
    console.log("App loaded. Waiting for auth state..."); // Auth observer triggers init

}); // End DOMContentLoaded
