const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('LauncherBackend', {
    // Свернуть окно
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    
    // Закрыть окно
    closeWindow: () => ipcRenderer.send('window-close'),
    
    // Подключение к серверу (передаем в главный процесс команду на запуск Steam)
    connect: (ip, port) => ipcRenderer.send('connect-to-server', { ip, port }),

    // Открытие внешней ссылки (новости и т.д.) в системном браузере
    openExternal: (url) => ipcRenderer.send('open-external-link', url),
    
    // Запрос данных сервера через gamedig
    queryServer: async (ip, port) => {
        return await ipcRenderer.invoke('query-gmod-server', { ip, port });
    },

    // Запрос данных мода из Steam Workshop (название, иконка, скриншоты, скачивания, рейтинг, автор)
    getWorkshopDetails: async (publishedFileId) => {
        return await ipcRenderer.invoke('get-steam-mod-details', publishedFileId);
    }
});