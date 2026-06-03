/**
 * MESH - Point d'entrée principal (Main Application)
 */
import * as crypto from './crypto.js';
import * as db from './database.js';
import * as compiler from './compiler.js';

const mySeed = 'u_' + Math.random().toString(36).substr(2, 4);
let activeThreadId = null;
let base64ImageCache = "";

// --- INIT APP ---
window.addEventListener('DOMContentLoaded', () => {
    // Initialisation du pseudo historique
    if(localStorage.getItem('p2p-username-modern')) {
        document.getElementById('usernameInput').value = localStorage.getItem('p2p-username-modern');
    }
    document.getElementById('usernameInput').addEventListener('input', (e) => {
        localStorage.setItem('p2p-username-modern', e.target.value.trim());
    });

    // Événements claviers (Envois rapides via Entrée)
    document.getElementById('postText').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); publishNewPost(); } };
    document.getElementById('replyText').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); publishNewReply(); } };

    // Démarrage et branchement réseau GunDB
    crypto.checkAutoLogin();
    db.initNetworkListeners(renderPostCard, () => {
        document.getElementById('globalFeed').innerHTML = '';
        closeThread();
    });

    // Rendre les fonctions accessibles aux éléments HTML à portée globale (onclick)
    window.generateAdminKeyFile = crypto.generateAdminKeyFile;
    window.importAdminKeyFile = (input) => crypto.importAdminKeyFile(input, () => lucide.createIcons());
    window.resetNetworkFeed = () => db.resetNetworkFeed(closeThread);
    window.deletePostNetwork = db.deletePostNetwork;
    window.openIDE = (code, lang) => compiler.openIDE(code, lang, updateIndicators);
    window.closeIDE = compiler.closeIDE;
    window.adaptTemplateLanguage = compiler.adaptTemplateLanguage;
    window.executeCompiler = compiler.executeCompiler;
    window.injectIdeCodeIntoBar = () => compiler.injectIdeCodeIntoBar(updateIndicators);
    window.handleImgUpload = handleImgUpload;
    window.publishNewPost = publishNewPost;
    window.publishNewReply = publishNewReply;
    window.openThread = openThread;
    window.closeThread = closeThread;

    lucide.createIcons();
});

// --- LOGIQUE ENVOI & AFFICHAGE UI ---

function handleImgUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5000000) { alert("Limite maximale 5 Mo."); return; }
    const reader = new FileReader();
    reader.onload = function(e) { base64ImageCache = e.target.result; updateIndicators(); };
    reader.readAsDataURL(file);
}

function updateIndicators() {
    let text = "";
    if (base64ImageCache) text += "📸 Img ";
    if (compiler.codeSnippetCache) text += `💻 Code (${compiler.codeLanguageCache.toUpperCase()}) `;
    document.getElementById('statusBox').innerText = text;
}

function publishNewPost() {
    const inputEl = document.getElementById('postText');
    const text = inputEl.value.trim();
    const author = document.getElementById('usernameInput').value.trim() || "Anonyme";
    if (!text && !base64ImageCache && !compiler.codeSnippetCache) return;
    
    const postId = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    db.postsNode.get(postId).put({
        id: postId, author: author, text: text,
        image: base64ImageCache || "", code: compiler.codeSnippetCache || "", lang: compiler.codeLanguageCache,
        timestamp: Date.now(), uid: mySeed
    });
    
    inputEl.value = ""; base64ImageCache = ""; compiler.clearCodeCache(); 
    document.getElementById('statusBox').innerText = "";
}

function publishNewReply() {
    if (!activeThreadId) return;
    const inputEl = document.getElementById('replyText');
    const text = inputEl.value.trim();
    const author = document.getElementById('usernameInput').value.trim() || "Anonyme";
    if (!text) return;
    
    const replyId = 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    db.postsNode.get(activeThreadId).get('replies').get(replyId).put({
        id: replyId, author: author, text: text, timestamp: Date.now()
    });
    inputEl.value = "";
}

function renderPostCard(postData) {
    if (document.getElementById(postData.id)) return;
    const feed = document.getElementById('globalFeed');
    const container = document.createElement('div'); 
    container.innerHTML = generateCardHTML(postData, false);
    if (feed.firstChild) feed.insertBefore(container.firstElementChild, feed.firstChild);
    else feed.appendChild(container.firstElementChild);
    lucide.createIcons();
}

function generateCardHTML(data, isReply = false) {
    let imgTag = data.image ? `<img class="post-image" src="${escapeHTML(data.image)}">` : '';
    let codeTag = data.code ? `<pre class="post-code-block" onclick="openIDE(\`${escapeHTML(data.code)}\`, '${escapeHTML(data.lang || 'javascript')}'); event.stopPropagation();"><span class="post-code-badge">${escapeHTML(data.lang || 'js')}</span><code>${escapeHTML(data.code)}</code></pre>` : '';
    let footer = isReply ? '' : `<div class="post-actions"><div class="action-btn"><i data-lucide="message-circle" size="14"></i> Réponses</div></div>`;
    let deleteBtn = isReply ? '' : `<button class="btn-delete-post" onclick="deletePostNetwork('${data.id}', event)"><i data-lucide="trash-2" size="14"></i></button>`;

    return `
        <div class="post-card" id="${data.id}" ${!isReply ? `onclick="openThread('${data.id}')"` : ''}>
            ${deleteBtn}
            <div class="post-meta">
                <span class="post-author">${escapeHTML(data.author)} <span>#${data.uid || 'anon'}</span></span>
                <span>${new Date(data.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            ${data.text ? `<div class="post-text">${escapeHTML(data.text)}</div>` : ''}
            ${imgTag} ${codeTag} ${footer}
        </div>
    `;
}

function openThread(postId) {
    activeThreadId = postId;
    const threadFeed = document.getElementById('threadFeed'); threadFeed.innerHTML = '';
    document.getElementById('threadPanel').classList.add('open');
    
    db.postsNode.get(postId).once((parentPost) => {
        if (!parentPost || db.blacklistedIds[postId] || parentPost.timestamp < db.currentResetTimestamp) return;
        const container = document.createElement('div'); container.innerHTML = generateCardHTML(parentPost, true);
        threadFeed.appendChild(container.firstElementChild);
        
        db.postsNode.get(postId).get('replies').map().off(); // Nettoie les anciens bindings
        db.postsNode.get(postId).get('replies').map().on((reply, rId) => {
            if (!reply || document.getElementById(rId) || db.blacklistedIds[rId] || reply.timestamp < db.currentResetTimestamp) return;
            const rContainer = document.createElement('div'); rContainer.innerHTML = generateCardHTML(reply, true);
            threadFeed.appendChild(rContainer.firstElementChild);
            lucide.createIcons();
        });
    });
}

function closeThread() { 
    document.getElementById('threadPanel').classList.remove('open'); 
    activeThreadId = null; 
}

function escapeHTML(str) { 
    return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t)); 
}
