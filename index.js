async function load_pyodide() {
    return loadPyodide().then(async pyodide => {
        await pyodide.loadPackage('numpy')
        return pyodide
    })
};

async function load_models() {
    const models_elm = document.getElementById('models');
    fetch('https://api.github.com/repos/funnyplanter/CuNNy/contents/pretrained')
        .then(r => r.json())
        .then(models => {
            models.forEach((model, i) => {
                v = document.createElement('option');
                v.value = model.download_url;
                v.innerHTML = model.name;
                models_elm.appendChild(v);
            });
        })
        .catch(console.error);
};

async function fetch_file(file, url=file) {
    return fetch(url)
        .then(r => r.arrayBuffer())
        .then(v => [file, new Uint8Array(v)]);
}

async function run() {
    let error_elm = document.getElementById('error');
    error_elm.textContent = '';
    let args = document.getElementById('args').value;
    let impl = document.getElementById('backend').value;
    if (!impl)
        return;
    pyodide.globals.set('unsplit_extra', args);
    let p_models = Array.from(document.getElementById('models').selectedOptions)
        .map(v => fetch_file(v.innerHTML, v.value))
    p_models.forEach(async p_model => {
        model = await p_model;
        pyodide.FS.writeFile(`./${model[0]}`, model[1]);
        let v = pyodide.runPython(`def f():
    try:
        return run('${model[0]}', '${impl}', shlex.split(unsplit_extra))
    except (Exception, AssertionError, SystemExit) as e:
        return traceback.format_exc()
f()`)
        if (typeof(v) === 'string') {
            error_elm.textContent = v;
            return;
        } else {
            let blob = new Blob([v[1]], {type: 'text/plain'});
            let link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = v[0];
            link.click();
            URL.revokeObjectURL(link.href);
        }
        pyodide.FS.unlink(`./${model[0]}`)
    });
}

async function help() {
    help_elm = document.getElementById('help');
    impl = document.getElementById('backend').value;
    if (!impl)
        return;
    help_txt = pyodide.runPython(`help('${impl}')`);
    help_elm.textContent = help_txt;
}

async function init() {
    let p_pyodide = load_pyodide();

    let files = await Promise.all([
        fetch_file('magpie.py'),
        fetch_file('mpv.py'),
        fetch_file('common.py')]);
    let gen = await fetch_file('gen.py');

    load_models();

    pyodide = await p_pyodide;
    files.forEach((file) => {
        pyodide.FS.writeFile(`./${file[0]}`, file[1]);
    });

    error_elm = document.getElementById('error');
    pyodide.setStdout({batched: str => error_elm.textContent += str + '\n'})
    pyodide.setStderr({batched: str => error_elm.textContent += str + '\n'})

    pyodide.runPython('import shlex\nimport traceback\nimport numpy as np\n' +
        (new TextDecoder('utf-8')).decode(gen[1]));

    run_elm = document.getElementById('run');
    run_elm.addEventListener('click', run);
    run_elm.disabled = false;

    args_elm = document.getElementById('args');
    args_elm.addEventListener('keydown', e => {
        if (e.key !== 'Enter')
            return;
        e.preventDefault();
        run();
    });
    args_elm.disabled = false;

    backends_elm = document.getElementById('backend');
    backends_elm.addEventListener('change', help);
    backends_elm.disabled = false;
}

init();
