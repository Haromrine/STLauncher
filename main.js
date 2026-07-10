const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { GameDig } = require('gamedig');

// Твой Steam Web API Ключ
const STEAM_API_KEY = 'C4FD20AEC43795D8D5773942A15A766A'; 

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 600,
        minWidth: 900,
        minHeight: 550,
        frame: false, // Отключаем стандартную рамку Windows
        resizable: true,
        icon: path.join(__dirname, 'icon.png'), // Иконка обновлена на icon.png
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- Обработчики системных кнопок ---
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

// --- Открытие внешних ссылок (новости и т.д.) в системном браузере ---
ipcMain.on('open-external-link', (event, url) => {
    shell.openExternal(url);
});

// --- Запуск Garry's Mod и подключение через Steam URI ---
ipcMain.on('connect-to-server', (event, { ip, port }) => {
    const steamConnectUri = `steam://connect/${ip}:${port}`;
    shell.openExternal(steamConnectUri);
});

// --- Живой Source Query опрос серверов ---
ipcMain.handle('query-gmod-server', async (event, { ip, port }) => {
    try {
        const response = await GameDig.query({
            type: 'garrysmod',
            host: ip,
            port: parseInt(port)
        });

        return {
            status: 'online',
            name: response.name || "Shinri Server",
            online: response.players.length,
            max_players: response.maxplayers,
            mode: response.raw.game || "Garry's Mod",
            map: response.map || "Неизвестно",
            ping: response.ping
        };
    } catch (error) {
        return {
            status: 'offline'
        };
    }
});

// --- ПОДКЛЮЧЕНИЕ К STEAM WORKSHOP ---
ipcMain.handle('get-steam-mod-details', async (event, publishedFileId) => {
    try {
        const fileDetailsUrl = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';
        const formData = new URLSearchParams();
        formData.append('itemcount', '1');
        formData.append('publishedfileids[0]', publishedFileId);

        const response = await fetch(fileDetailsUrl, {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const resData = await response.json();
        const fileDetails = resData.response?.publishedfiledetails?.[0];

        if (!fileDetails || fileDetails.result !== 1) {
            throw new Error('Аддон не найден в Steam Workshop');
        }

        // Запрос к ISteamUser для получения никнейма автора по его SteamID64
        let authorName = `ID: ${fileDetails.creator}`;
        if (fileDetails.creator) {
            const userSummaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${fileDetails.creator}`;
            const userResponse = await fetch(userSummaryUrl);
            const userData = await userResponse.json();
            const player = userData.response?.players?.[0];
            if (player && player.personaname) {
                authorName = player.personaname;
            }
        }

        // Собираем массив картинок (превью + скриншоты)
        const imagesList = [];
        if (fileDetails.preview_url) imagesList.push(fileDetails.preview_url);
        
        if (fileDetails.images && Array.isArray(fileDetails.images)) {
            fileDetails.images.forEach(img => {
                if (img.url) imagesList.push(img.url);
            });
        }

        // Рассчитываем рейтинг звезд (от 1 до 5)
        const votesUp = fileDetails.vote_data?.votes_up || 0;
        const votesDown = fileDetails.vote_data?.votes_down || 0;
        const totalVotes = votesUp + votesDown;
        const rating = totalVotes > 0 ? Math.ceil((votesUp / totalVotes) * 5) : 5;

        return {
            status: 'success',
            title: fileDetails.title,
            desc: fileDetails.description || 'Описание отсутствует.',
            author: authorName,
            downloads: parseInt(fileDetails.subscriptions || 0).toLocaleString('ru-RU'),
            rating: rating,
            images: imagesList,
            steamId: publishedFileId
        };

    } catch (error) {
        console.error('Steam API Error:', error);
        return { status: 'error', message: error.message };
    }
});