// Firebase Configuration (Requires Web SDK keys from Firebase Console)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // <--- Paste your Web API Key here
    authDomain: "isthistuffingtonfr.firebaseapp.com",
    databaseURL: "https://isthistuffingtonfr-default-rtdb.firebaseio.com",
    projectId: "isthistuffingtonfr",
    storageBucket: "isthistuffingtonfr.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
}

// State Management
const state = {
    user: null,
    currentSection: 'login',
    worlds: []
};

// UI Elements
const sections = {
    login: document.getElementById('login-section'),
    create: document.getElementById('create-section'),
    explore: document.getElementById('explore-section')
};

const nav = document.getElementById('main-nav');
const loginBtn = document.getElementById('login-btn');
const generateBtn = document.getElementById('generate-btn');
const worldInput = document.getElementById('world-details');
const chatMessages = document.getElementById('chat-messages');

// Navigation Logic
function showSection(sectionName) {
    Object.keys(sections).forEach(key => {
        sections[key].style.display = key === sectionName ? (key === 'explore' ? 'block' : 'flex') : 'none';
        if (key === 'create' && sectionName === 'create') sections[key].style.display = 'block';
    });
    
    state.currentSection = sectionName;
    
    // Update Nav Active State
    document.querySelectorAll('nav a').forEach(a => {
        a.classList.toggle('active', a.id === `nav-${sectionName}`);
    });
}

// Mock Login
loginBtn.addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    if (email) {
        state.user = { email };
        nav.style.display = 'flex';
        showSection('create');
        addChatMessage('System', `Identity verified: ${email}. Portals active.`);
    }
});

// Navigation Links
document.getElementById('nav-create').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('create');
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
                model: 'black-forest-labs/flux-2-pro',
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
            addChatMessage('Bot', `Behold, the manifestation of your vision:`);
            
            // Create image element in chat
            const imgContainer = document.createElement('div');
            imgContainer.className = 'glass-panel animate-in';
            imgContainer.style.marginTop = '1rem';
            imgContainer.style.overflow = 'hidden';
            imgContainer.innerHTML = `<img src="${imageUrl}" style="width: 100%; border-radius: 12px; display: block;" onerror="this.parentElement.innerHTML='<p style=padding:20px>Image failed to load</p>'">`;
            chatMessages.appendChild(imgContainer);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Push to Firebase for global "Explore" tab
            saveWorldToFirebase(details, imageUrl);
        } else {
            console.error("No image URL found in output:", result);
            addChatMessage('Bot', `The portal flickered. (Error: ${result.error || 'No output found'}). Try another vision?`);
        }
    } catch (error) {
        console.error('Generation failed:', error);
        status.style.opacity = '0';
        addChatMessage('Bot', "A temporal rift (Network Error) occurred. Please check your connection or API status.");
    }
});

// 2. Real-time Subscription for "Explore"
function initExploreListener() {
    if (typeof firebase === 'undefined') return;
    
    const worldsRef = firebase.database().ref('worlds');
    const gallery = document.getElementById('gallery-grid');
    
    // Clear existing mock content
    gallery.innerHTML = '';

    worldsRef.on('child_added', (snapshot) => {
        const data = snapshot.val();
        const worldId = snapshot.key;
        if (!data) return;

        const card = document.createElement('div');
        card.className = 'glass-panel animate-in';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.overflow = 'hidden';
        card.style.borderRadius = '24px';
        
        const isOwner = state.user && state.user.email === data.user;

        card.innerHTML = `
            <div class="world-card" style="background-image: url('${data.url}'); flex: 1; border-radius: 0;">
                <div class="card-overlay">
                    <h3>${data.prompt.substring(0, 20)}${data.prompt.length > 20 ? '...' : ''}</h3>
                    <p>by ${data.user}</p>
                    ${isOwner ? `<button class="creator-btn" onclick="toggleComments('${worldId}')" style="margin-top: 10px;">Hide/Show Comments</button>` : ''}
                </div>
            </div>
            <div id="comments-${worldId}" class="comment-section ${data.commentsHidden ? 'hidden-comments' : ''}">
                <!-- Comments will load here -->
            </div>
            <div class="comment-controls">
                <input type="text" id="input-${worldId}" class="comment-input" placeholder="Add a thought...">
                <button class="creator-btn" onclick="postComment('${worldId}')">Post</button>
            </div>
        `;
        gallery.prepend(card);

        // Sub-listener for comments
        const commentsRef = firebase.database().ref(`worlds/${worldId}/comments`);
        const commentBox = card.querySelector(`#comments-${worldId}`);
        
        commentsRef.on('child_added', (commentSnap) => {
            const comment = commentSnap.val();
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `<span class="author">${comment.user.split('@')[0]}:</span> ${comment.text}`;
            commentBox.appendChild(div);
            commentBox.scrollTop = commentBox.scrollHeight;
        });

        // Sub-listener for visibility toggle
        firebase.database().ref(`worlds/${worldId}/commentsHidden`).on('value', (hideSnap) => {
            if (hideSnap.val()) {
                commentBox.classList.add('hidden-comments');
            } else {
                commentBox.classList.remove('hidden-comments');
            }
        });
    });
}

// Global scope functions for onclick handlers
window.postComment = (worldId) => {
    const input = document.getElementById(`input-${worldId}`);
    const text = input.value;
    if (!text || !state.user) return;

    firebase.database().ref(`worlds/${worldId}/comments`).push({
        user: state.user.email,
        text: text,
        timestamp: Date.now()
    });
    input.value = '';
};

window.toggleComments = (worldId) => {
    const ref = firebase.database().ref(`worlds/${worldId}/commentsHidden`);
    ref.once('value').then(snap => {
        ref.set(!snap.val());
    });
};

async function saveWorldToFirebase(prompt, url) {
    if (typeof firebase === 'undefined' || !state.user) return;
    
    const worldsRef = firebase.database().ref('worlds');
    await worldsRef.push({
        prompt: prompt,
        url: url,
        user: state.user.email,
        timestamp: Date.now()
    });
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
