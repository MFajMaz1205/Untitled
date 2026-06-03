// Variable globale pour stocker l'instance
let pyodide = null;

async function executeCompiler() {
    const lang = document.getElementById('ideLang').value;
    const code = document.getElementById('ideSource').value;
    const output = document.getElementById('consoleOutput');

    if (lang === 'python') {
        output.innerText = "Chargement Python...";
        // Chargement différé si pas encore fait
        if (!pyodide) {
            pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/" });
        }
        try {
            let result = await pyodide.runPythonAsync(code);
            output.innerText = result;
        } catch (e) {
            output.innerText = "Erreur : " + e;
        }
    } else {
        // Logique pour JavaScript
        try {
            output.innerText = eval(code);
        } catch (e) {
            output.innerText = "Erreur JS : " + e;
        }
    }
}

function openIDE() { document.getElementById('idePanel').style.display = 'flex'; }
function closeIDE() { document.getElementById('idePanel').style.display = 'none'; }
