/**
 * MESH - Module Cryptographique & Sécurité
 */

// =========================================================================
// 🔒 CONFIGURATION FIXE : COPIE ICI LE TEXTE DE TA CLÉ PUBLIQUE TRÈS LONGUE
// =========================================================================
export let MAIN_ADMIN_PUBLIC_KEY = "INITIAL_SETUP"; 
// =========================================================================

export let isAdminActive = false;
export let myKeyPair = null;

/**
 * Génère un couple de clés SEA et le télécharge sous forme de fichier JSON
 */
export async function generateAdminKeyFile() {
    const pair = await Gun.SEA.pair();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pair));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "mesh_admin_key.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    alert("📥 Fichier 'mesh_admin_key.json' téléchargé !\n\nOuvre-le, copie la valeur de 'pub' et insère-la dans ton fichier 'js/crypto.js' pour verrouiller l'administration.");
}

/**
 * Lit un fichier JSON chargé, extrait la clé et valide les droits d'administration
 */
export function importAdminKeyFile(input, onSuccess) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const parsedKey = JSON.parse(e.target.result);
            if(parsedKey.pub && parsedKey.priv) {
                myKeyPair = parsedKey;
                
                // Configuration automatique au tout premier démarrage
                if (MAIN_ADMIN_PUBLIC_KEY === "INITIAL_SETUP") {
                    MAIN_ADMIN_PUBLIC_KEY = myKeyPair.pub;
                }

                if (myKeyPair.pub === MAIN_ADMIN_PUBLIC_KEY) {
                    localStorage.setItem('mesh_saved_keypair', JSON.stringify(myKeyPair));
                    activateAdminUI();
                    if(onSuccess) onSuccess();
                } else {
                    alert("❌ Ce fichier de clé ne correspond pas à l'administrateur configuré.");
                }
            }
        } catch(err) {
            alert("❌ Fichier JSON corrompu ou invalide.");
        }
    };
    reader.readAsText(file);
}

/**
 * Active l'état administrateur en mémoire et sur l'interface graphique
 */
export function activateAdminUI() {
    isAdminActive = true;
    document.body.classList.add('admin-mode');
    const btn = document.getElementById('adminBtn');
    const txt = document.getElementById('adminBtnText');
    if(btn) btn.classList.add('is-admin');
    if(txt) txt.innerText = "Mode Admin Activé 🔒";
}

/**
 * Tente de restaurer une session admin existante au chargement de la page
 */
export function checkAutoLogin() {
    const savedKey = localStorage.getItem('mesh_saved_keypair');
    if(savedKey) {
        myKeyPair = JSON.parse(savedKey);
        activateAdminUI();
    }
}
