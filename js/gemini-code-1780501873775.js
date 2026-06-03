/**
 * MESH - Module Réseau & GunDB
 */
import { MAIN_ADMIN_PUBLIC_KEY, myKeyPair, isAdminActive } from './crypto.js';

export const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://gundb-relay.onrender.com/gun']);
export const postsNode = gun.get('mesh-posts-crypto-v6');
export const blacklistNode = gun.get('mesh-blacklist-crypto-v6');
export const systemControlNode = gun.get('mesh-system-crypto-v6');

export let blacklistedIds = {};
export let currentResetTimestamp = 0;
export let localPostsCache = {};

try { localPostsCache = JSON.parse(localStorage.getItem('mesh_posts_backup')) || {}; } catch(e) {}

/**
 * Envoie un ordre signé de suppression pour un message ciblé
 */
export async function deletePostNetwork(postId) {
    if(!isAdminActive || !myKeyPair) return;

    if(confirm("Bannir définitivement ce message ?")) {
        const order = { action: "delete", target: postId };
        const signedProof = await Gun.SEA.sign(order, myKeyPair);

        blacklistNode.get(postId).put({
            msg: order,
            sig: signedProof,
            pub: myKeyPair.pub
        });
    }
}

/**
 * Envoie un ordre signé de réinitialisation complète du salon de discussion
 */
export async function resetNetworkFeed(closeThreadCallback) {
    if(!isAdminActive || !myKeyPair) return;
    if(confirm("⚠️ Supprimer TOUS les messages du workspace pour tout le monde ?")) {
        const resetTime = Date.now();
        const order = { action: "global_reset", timestamp: resetTime };
        const signedProof = await Gun.SEA.sign(order, myKeyPair);

        systemControlNode.put({
            msg: order,
            sig: signedProof,
            pub: myKeyPair.pub
        });
        if(closeThreadCallback) closeThreadCallback();
    }
}

/**
 * Initialise les abonnements (Écouteurs) du réseau GunDB
 */
export function initNetworkListeners(onNewPost, onResetFeed) {
    // Écoute des suppressions (Blacklist)
    blacklistNode.map().on(async (data, id) => {
        if (!data || !data.sig || data.pub !== MAIN_ADMIN_PUBLIC_KEY) return;
        
        const verified = await Gun.SEA.verify(data.sig, MAIN_ADMIN_PUBLIC_KEY);
        if(verified && verified.action === "delete" && verified.target === id) {
            blacklistedIds[id] = true;
            const el = document.getElementById(id);
            if(el) el.remove();
            
            if(localPostsCache[id]) {
                delete localPostsCache[id];
                localStorage.setItem('mesh_posts_backup', JSON.stringify(localPostsCache));
            }
        }
    });

    // Écoute des Resets Globaux
    systemControlNode.on(async (data) => {
        if (!data || !data.sig || data.pub !== MAIN_ADMIN_PUBLIC_KEY) return;
        
        const verified = await Gun.SEA.verify(data.sig, MAIN_ADMIN_PUBLIC_KEY);
        if(verified && verified.action === "global_reset" && verified.timestamp > currentResetTimestamp) {
            currentResetTimestamp = verified.timestamp;
            localPostsCache = {};
            localStorage.setItem('mesh_posts_backup', JSON.stringify(localPostsCache));
            if(onResetFeed) onResetFeed();
        }
    });

    // Écoute des nouveaux messages
    postsNode.map().on((post, id) => {
        if (!post || !id || blacklistedIds[id] || blacklistedIds[post.id]) return;
        
        const msgTime = post.timestamp || Date.now();
        if (msgTime < currentResetTimestamp) return;

        const cleanPost = {
            id: post.id || id, author: post.author, text: post.text, image: post.image,
            code: post.code, lang: post.lang, timestamp: msgTime, uid: post.uid
        };
        
        localPostsCache[id] = cleanPost;
        try { localStorage.setItem('mesh_posts_backup', JSON.stringify(localPostsCache)); } catch(e) {}
        
        onNewPost(cleanPost);
    });
}