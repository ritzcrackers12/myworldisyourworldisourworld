// Firebase initialization (Config loaded from config.js)

// Initialize Firebase
let db;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// State Management
const state = {
    user: null,
    currentSection: 'login',
    lastGallerySection: 'explore',
    worlds: []
};

// UI Elements
const sections = {
    login: document.getElementById('login-section'),
    create: document.getElementById('create-section'),
    explore: document.getElementById('explore-section'),
    userWorlds: document.getElementById('user-worlds-section'),
    detail: document.getElementById('detail-section')
};

const nav = document.getElementById('main-nav');
const loginBtn = document.getElementById('login-btn');
const generateBtn = document.getElementById('generate-btn');
const worldInput = document.getElementById('world-details');
const chatMessages = document.getElementById('chat-messages');

// Navigation Logic
function showSection(sectionName) {
    Object.keys(sections).forEach(key => {
        sections[key].style.display = key === sectionName ? 
            (['explore', 'detail', 'userWorlds'].includes(key) ? 'block' : 'flex') : 'none';
    });
    
    state.currentSection = sectionName;
    if (sectionName === 'explore' || sectionName === 'userWorlds') {
        state.lastGallerySection = sectionName;
    }

    // Update Nav Active State
    document.querySelectorAll('nav a').forEach(a => {
        a.classList.toggle('active', a.id === `nav-${sectionName}` || (sectionName === 'userWorlds' && a.id === 'nav-your-world'));
    });
}

// Authentication logic
const loginError = document.getElementById('login-error');

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.opacity = '1';
    setTimeout(() => loginError.style.opacity = '0', 3000);
}

// Register Logic
document.getElementById('register-btn').addEventListener('click', async () => {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;

    if (!user || !pass) return showLoginError("Username and password required.");
    if (user.length < 3) return showLoginError("Username too short.");
    
    console.log("Attempting registration:", user);
    if (!firebase || !db) {
        console.error("Firebase/DB not initialized");
        return showLoginError("Connection to void lost.");
    }

    const userRef = firebase.database().ref(`users/${user}`);
    const snapshot = await userRef.once('value');

    if (snapshot.exists()) {
        console.warn("User already exists:", user);
        return showLoginError("That identity is already taken.");
    }

    await userRef.set({ password: pass, created: Date.now() });
    console.log("Registration successful for:", user);
    
    state.user = { name: user };
    nav.style.display = 'flex';
    showSection('create');
    addChatMessage('System', `Identity created for ${user}. Portals open.`);
});

// Login Logic
loginBtn.addEventListener('click', async () => {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;

    if (!user || !pass) return showLoginError("Enter your credentials.");
    
    console.log("Attempting login:", user);
    if (!firebase || !db) {
        console.error("Firebase/DB not initialized");
        return showLoginError("Connection to void lost.");
    }

    const userRef = firebase.database().ref(`users/${user}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
        console.warn("User not found:", user);
        return showLoginError("Identity not found. Begin a new journey?");
    }

    const userData = snapshot.val();
    if (userData.password !== pass) {
        console.warn("Invalid password for:", user);
        return showLoginError("Forbidden. Credentials do not match.");
    }

    console.log("Login successful for:", user);

    state.user = { name: user };
    nav.style.display = 'flex';
    showSection('create');
    addChatMessage('System', `Welcome back, ${user}. Re-establishing portal connection.`);
    
    // Find last world by this user with improved error handling
    firebase.database().ref('worlds').orderByChild('user').equalTo(user).limitToLast(1).once('value', (snap) => {
        if (snap.exists()) {
            const data = snap.val();
            state.lastWorldId = Object.keys(data)[0];
            console.log("Found your most recent manifest:", state.lastWorldId);
        } else {
            console.log("No previous manifests found for this identity.");
            state.lastWorldId = null;
        }
    }, (error) => {
        console.error("Firebase query failed (check your Rules for .indexOn):", error);
    });
});

// Navigation Links
document.getElementById('nav-create').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('create');
});

document.getElementById('nav-your-world').addEventListener('click', (e) => {
    e.preventDefault();
    if (state.user) {
        showUserWorlds();
    } else {
        showSection('login');
    }
});

document.getElementById('nav-explore').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('explore');
});

document.getElementById('nav-logout').addEventListener('click', (e) => {
    e.preventDefault();
    state.user = null;
    nav.style.display = 'none';
    showSection('login');
});

// Chat Logic
function addChatMessage(sender, text, isUser = false) {
    const msg = document.createElement('div');
    msg.className = 'glass-panel animate-in';
    msg.style.padding = '1.2rem 2rem';
    msg.style.borderRadius = isUser ? '24px 24px 4px 24px' : '4px 24px 24px 24px';
    msg.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
    msg.style.maxWidth = '80%';
    msg.style.background = isUser ? 'rgba(108, 92, 231, 0.2)' : 'rgba(255, 255, 255, 0.03)';
    
    msg.innerHTML = `<p style="font-size: 1.1rem; line-height: 1.5;">${text}</p>`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Generation Logic
generateBtn.addEventListener('click', async () => {
    const details = worldInput.value;
    if (!details) return;

    addChatMessage('User', details, true);
    worldInput.value = '';

    const status = document.getElementById('generation-status');
    status.style.opacity = '1';
    status.textContent = "Summoning your world...";
    
    try {
        const response = await fetch('https://itp-ima-replicate-proxy.web.app/api/create_n_get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'black-forest-labs/flux-schnell',
                input: { prompt: details }
            })
        });

        const result = await response.json();
        console.log("API Response:", result);
        status.style.opacity = '0';

        let imageUrl = null;
        if (result.output) {
            if (Array.isArray(result.output) && result.output.length > 0) {
                imageUrl = result.output[0];
            } else if (typeof result.output === 'string') {
                imageUrl = result.output;
            }
        }

        if (imageUrl) {
            console.log("Image URL received:", imageUrl);
            
            // Save to Firebase and show in Detail View immediately
            try {
                const worldId = await saveWorldToFirebase(details, imageUrl);
                console.log("Generation successful, navigating to gallery...");
                state.lastWorldId = worldId;
                showUserWorlds(); 
            } catch (fbError) {
                console.warn("Firebase save failed:", fbError);
                addChatMessage('Bot', "Your world was manifested, but I couldn't save it to the collective memory.");
            }
        } else {
            console.error("No image URL found in output:", result);
            addChatMessage('Bot', `The portal flickered. (Error: ${result.error || 'No output found'}). Try another vision?`);
        }
    } catch (error) {
        console.error('Generation process crashed:', error);
        status.style.opacity = '0';
        addChatMessage('Bot', "A temporal rift occurred. Check the browser console (F12) for details.");
    }
});

let currentDetailListener = null;

async function showWorldDetail(worldId) {
    if (!firebase || !db) return;
    
    showSection('detail');
    const promptEl = document.getElementById('detail-prompt');
    const authorEl = document.getElementById('detail-author');
    const commentsEl = document.getElementById('detail-comments');
    const postBtn = document.getElementById('detail-post-btn');
    const commentInput = document.getElementById('detail-comment-input');

    promptEl.textContent = 'Opening portal...';
    authorEl.textContent = '';
    
    const worldRef = firebase.database().ref(`worlds/${worldId}`);
    const snapshot = await worldRef.once('value');
    const data = snapshot.val();

    if (!data) {
        promptEl.textContent = 'World not found.';
        return;
    }

    promptEl.textContent = `"${data.prompt}"`;
    authorEl.textContent = `by ${data.user}`;
    document.getElementById('detail-img-full').src = data.url;
    
    // Clear previous comments and listeners
    commentsEl.innerHTML = '';
    if (currentDetailListener) {
        firebase.database().ref(`worlds/${worldId}/comments`).off();
    }

    // Load and listen for comments
    currentDetailListener = firebase.database().ref(`worlds/${worldId}/comments`);
    currentDetailListener.on('child_added', (snapshot) => {
        const comment = snapshot.val();
        const div = document.createElement('div');
        div.className = 'comment-item';
        div.style.padding = '1.2rem';
        div.style.marginBottom = '1rem';
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.borderRadius = '16px';
        div.innerHTML = `<span class="author" style="font-size: 1rem; color: var(--secondary-accent); font-weight: 800;">${comment.user}:</span> <span style="font-size: 1.1rem; color: var(--text-main);">${comment.text}</span>`;
        commentsEl.appendChild(div);
        commentsEl.scrollTop = commentsEl.scrollHeight;
    });

    // Update Post button click handler
    postBtn.onclick = () => {
        const text = commentInput.value;
        if (!text || !state.user) return;
        
        firebase.database().ref(`worlds/${worldId}/comments`).push({
            user: state.user.name,
            text: text,
            timestamp: Date.now()
        });
        commentInput.value = '';
    };
}

// Detail View Event Listeners
document.getElementById('back-to-explore').addEventListener('click', () => {
    showSection(state.lastGallerySection || 'explore');
});

// 2. Real-time Subscription for "Explore"
async function showUserWorlds() {
    if (!firebase || !db || !state.user) return;
    
    showSection('userWorlds');
    const grid = document.getElementById('user-gallery-grid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">Retrieving your manifestations...</div>';

    try {
        const snap = await firebase.database().ref('worlds')
            .orderByChild('user').equalTo(state.user.name).once('value');
        
        grid.innerHTML = '';
        const worlds = snap.val();

        if (!worlds) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">You haven\'t summoned any worlds yet traveler.</div>';
            return;
        }

        // Convert to array and sort by newest
        const worldIds = Object.keys(worlds).reverse();
        
        worldIds.forEach(id => {
            const data = worlds[id];
            const card = createGalleryCard(id, data, false); // NO comments for personal cards
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to load user worlds:", err);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">The void is currently unreachable.</div>';
    }
}

function createGalleryCard(worldId, data, includeComments = true) {
    const card = document.createElement('div');
    card.className = 'glass-panel animate-in';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.overflow = 'hidden';
    card.style.borderRadius = '24px';
    card.style.cursor = 'pointer';
    
    let innerHTML = `
        <div class="world-card" style="background-image: url('${data.url}'); height: 300px; border-radius: 0;">
            <div class="card-overlay">
                <h3 style="margin-bottom: 0px;">${data.prompt.substring(0, 40)}${data.prompt.length > 40 ? '...' : ''}</h3>
                <p style="font-size: 0.8rem; opacity: 0.7;">by ${data.user}</p>
            </div>
        </div>
    `;

    if (includeComments) {
        innerHTML += `
            <div id="explore-comments-${worldId}" class="comment-section" style="max-height: 150px; background: rgba(0,0,0,0.2);">
                <!-- Comments will load here -->
            </div>
            <div class="comment-controls">
                <input type="text" id="explore-input-${worldId}" class="comment-input" placeholder="Add a thought...">
                <button class="send-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem;" onclick="event.stopPropagation(); postExploreComment('${worldId}')">Post</button>
            </div>
        `;
    }

    card.innerHTML = innerHTML;

    card.addEventListener('click', () => {
        showWorldDetail(worldId);
    });

    if (includeComments) {
        // Load existing comments for this card
        const commentsRef = firebase.database().ref(`worlds/${worldId}/comments`);
        const commentBox = card.querySelector(`#explore-comments-${worldId}`);
        
        commentsRef.on('child_added', (commentSnap) => {
            const comment = commentSnap.val();
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.style.padding = '0.5rem';
            div.style.marginBottom = '0.5rem';
            div.innerHTML = `<span class="author" style="font-size: 0.8rem;">${comment.user}:</span> <span style="font-size: 0.8rem;">${comment.text}</span>`;
            commentBox.appendChild(div);
            commentBox.scrollTop = commentBox.scrollHeight;
        });
    }

    return card;
}

function initExploreListener() {
    if (typeof firebase === 'undefined') return;
    
    const worldsRef = firebase.database().ref('worlds');
    const gallery = document.getElementById('gallery-grid');
    gallery.innerHTML = '';

    worldsRef.on('child_added', (snapshot) => {
        const data = snapshot.val();
        const worldId = snapshot.key;
        if (!data) return;

        const card = createGalleryCard(worldId, data);
        gallery.prepend(card);
    });
}


// Global scope function for explore card comments
window.postExploreComment = (worldId) => {
    const input = document.getElementById(`explore-input-${worldId}`);
    const text = input.value;
    if (!text || !state.user) return;

    firebase.database().ref(`worlds/${worldId}/comments`).push({
        user: state.user.name,
        text: text,
        timestamp: Date.now()
    });
    input.value = '';
};

async function saveWorldToFirebase(prompt, url) {
    if (typeof firebase === 'undefined' || !state.user) return null;
    
    const worldsRef = firebase.database().ref('worlds');
    const newWorldRef = worldsRef.push();
    await newWorldRef.set({
        prompt: prompt,
        url: url,
        user: state.user.name,
        timestamp: Date.now()
    });
    return newWorldRef.key;
}

// Update the generate handler to use Firebase
// (Inside generateBtn.addEventListener)
// ... result.output check ...
/*
            const imageUrl = result.output[0];
            addChatMessage('Bot', `Behold, the manifestation of your vision:`);
            
            const imgContainer = document.createElement('div');
            ...
            chatMessages.appendChild(imgContainer);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // NEW: Push to Firebase
            saveWorldToFirebase(details, imageUrl);
*/

// Initial View
showSection('login');
initExploreListener();
