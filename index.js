const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSSMCommand } = require('./utils/commands');
const { loadConnections, saveConnections } = require('./utils/storage');
const { spawn } = require('child_process');

let mainWindow;
const processes = {};

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  ipcMain.on('request-connections', (event) => {
    try {
      const connections = loadConnections();
      event.sender.send('load-connections', connections);
    } catch (err) {
      console.error('Erro ao enviar conexões:', err);
      event.sender.send('load-connections', []);
    }
  });
});

ipcMain.handle('connect-to-db', async (event, dbConfig) => {
  const { id, name } = dbConfig;

  if (processes[id]) {
    processes[id].process.kill();
    delete processes[id];
  }

  try {
    const process = await execSSMCommand(dbConfig);

    process.stdout.on('data', (data) => {
      const output = data.toString();

      if (output.includes('SessionId:')) {
        const match = output.match(/SessionId: (\w+-\w+)/);
        const sessionId = match ? match[1] : null;
        processes[id] = { process, sessionId };
      }

      mainWindow.webContents.send('db-log', { id, name, message: output });
    });

    process.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      console.error(`Erro conexão ${name}: ${errorMsg}`);
      mainWindow.webContents.send('db-log', { id, name, message: `Erro: ${errorMsg}` });
    });

    process.on('close', (code) => {
      mainWindow.webContents.send('db-status', { id, name, status: 'desconectado' });
      delete processes[id];
    });

    mainWindow.webContents.send('db-status', { id, name, status: 'conectado' });

    return { success: true, message: 'Conexão iniciada' };
  } catch (error) {
    console.error(`Erro ao conectar ${name}: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('disconnect-db', async (event, { id, profile }) => {
  if (processes[id]) {
    const { sessionId } = processes[id];
    const command = 'aws';
    const args = ['ssm', 'terminate-session', '--session-id', sessionId, '--profile', profile];

    try {
      const terminateProcess = spawn(command, args);

      await new Promise((resolve, reject) => {
        terminateProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Falha ao encerrar sessão SSM para id ${id}`));
        });
      });

      mainWindow.webContents.send('db-status', { id, status: 'desconectado' });
      delete processes[id];
      return { success: true, message: 'Sessão encerrada' };
    } catch (error) {
      console.error(`Erro ao desconectar id ${id}: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  return { success: false, message: 'Nenhuma conexão ativa encontrada' };
});

ipcMain.on('save-connections', (event, connections) => {
  saveConnections(connections);
  mainWindow.webContents.send('load-connections', connections);
});
