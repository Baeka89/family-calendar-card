const fs = require('node:fs');
const path = require('node:path');
const { parseAst } = require('rollup/parseAst');

function listSources(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listSources(file) : file.endsWith('.js') ? [file] : [];
  });
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => visit(child, callback));
    else if (value && typeof value === 'object') visit(value, callback);
  }
}

const files = listSources(path.resolve(__dirname, '../src')).sort();
for (const file of files) {
  visit(parseAst(fs.readFileSync(file, 'utf8')), node => {
    if (node.type !== 'ClassBody') return;
    const methods = new Set();
    for (const method of node.body) {
      if (method.computed || method.type !== 'MethodDefinition') continue;
      const key = `${method.static}:${method.kind}:${method.key.name ?? method.key.value}`;
      if (methods.has(key)) throw new Error(`Duplicate class method in ${file}: ${key}`);
      methods.add(key);
    }
  });
}
console.log(`Syntax and duplicate class methods checked in ${files.length} source files.`);
