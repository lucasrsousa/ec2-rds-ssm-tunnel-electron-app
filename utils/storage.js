const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const getConnectionsPath = () => {
  const dir = app.getPath('userData');
  const filePath = path.join(dir, 'connections.json');

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
  }

  return filePath;
};

function loadConnections() {
  try {
    const filePath = getConnectionsPath();
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Erro ao carregar conexões:', err);
    return [];
  }
}

function saveConnections(connections) {
  try {
    const filePath = getConnectionsPath();
    fs.writeFileSync(filePath, JSON.stringify(connections, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar conexões:', err);
  }
}

module.exports = { loadConnections, saveConnections, getConnectionsPath };