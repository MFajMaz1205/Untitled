/**
 * MESH - Module Compilateur / IDE
 */

export let pyodideInstance = null;
export let codeSnippetCache = "";
export let codeLanguageCache = "javascript";

export const templates = {
    javascript: `// Script JS\nlet message = "Hello World !";\nconsole.log(message);`,
    python: `# Script Python\nfor i in range(3):\n    print(f"Ligne : {i}")`,
    html: `\n<div style="padding:15px; text-align:center; color:#4f46e5;">\n  <h3>Rendu OK</h3>\n</div>`
};

export function openIDE(preloadedCode = "", lang = "javascript", updateIndicatorsCallback) {
    document.getElementById('idePanel').classList.add('open');
    document.getElementById('ideLang').value = lang;
    if (preloadedCode) document.getElementById('ideSource').value = preloadedCode;
    else adaptTemplateLanguage();
    toggleOutputs();
}

export function closeIDE() { 
    document.getElementById('idePanel').classList.remove('open'); 
}

export function adaptTemplateLanguage() {
    const lang = document.getElementById('ideLang').value;
    document.getElementById('ideSource').value = templates[lang];
    toggleOutputs();
}

export function toggleOutputs() {
    const lang = document.getElementById('ideLang').value;
    const consoleOut = document.getElementById('consoleOutput');
    const htmlPreview = document.getElementById('htmlPreview');
    if(lang === "html") {
        consoleOut.style.display = "none"; htmlPreview.style.display = "block";
        document.getElementById('consoleTitle').innerText = "LIVE VIEW";
    } else {
        consoleOut.style.display = "block"; htmlPreview.style.display = "none";
        document.getElementById('consoleTitle').innerText = "CONSOLE";
    }
}

export async function executeCompiler() {
    const lang = document.getElementById('ideLang').value;
    const code = document.getElementById('ideSource').value;
    const consoleOut = document.getElementById('consoleOutput');
    const htmlPreview = document.getElementById('htmlPreview');
    consoleOut.style.color = "#38bdf8"; consoleOut.innerText = "";

    if (lang === "javascript") {
        const originalLog = console.log;
        console.log = function(...args) { consoleOut.innerText += args.join(' ') + '\n'; };
        try {
            new Function(code)();
            if(!consoleOut.innerText) consoleOut.innerText = "> Exécuté.";
        } catch (err) { consoleOut.style.color = "#ff5a79"; consoleOut.innerText = `❌ ${err.message}`; }
        console.log = originalLog;
    } else if (lang === "html") {
        const dst = htmlPreview.contentDocument || htmlPreview.contentWindow.document;
        dst.open(); dst.write(code); dst.close();
    } else if (lang === "python") {
        document.getElementById('pyLoading').style.display = "inline";
        try {
            if (!pyodideInstance) pyodideInstance = await loadPyodide();
            pyodideInstance.runPython(`import sys\nimport io\nsys.stdout = io.StringIO()`);
            await pyodideInstance.runPythonAsync(code);
            consoleOut.innerText = pyodideInstance.runPython("sys.stdout.getvalue()") || "> Exécuté.";
        } catch (err) { consoleOut.style.color = "#ff5a79"; consoleOut.innerText = `❌ ${err.message}`; }
        document.getElementById('pyLoading').style.display = "none";
    }
}

export function injectIdeCodeIntoBar(updateIndicatorsCallback) {
    const code = document.getElementById('ideSource').value.trim();
    if(code) {
        codeSnippetCache = code; 
        codeLanguageCache = document.getElementById('ideLang').value;
        if(updateIndicatorsCallback) updateIndicatorsCallback(); 
        closeIDE();
    }
}

export function clearCodeCache() {
    codeSnippetCache = "";
}
