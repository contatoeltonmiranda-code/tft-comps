// Copia dados e logica do projeto para overwolf-app/vendor (o Overwolf so carrega arquivos de dentro da pasta do app).
// Uso: node overwolf-app/sync.js   (tests/overwolf-app.test.js falha se as copias ficarem velhas)
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const arquivos = ['data/catalog.js', 'data/seed.js', 'data/recipes.js', 'js/recommend.js', 'js/gep-map.js'];
const destino = path.join(__dirname, 'vendor');
fs.mkdirSync(destino, { recursive: true });
arquivos.forEach((a) => {
  fs.copyFileSync(path.join(raiz, a), path.join(destino, path.basename(a)));
  console.log('ok', a);
});
