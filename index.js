var electron = require('electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var window

function createWindow () {
    // Create the browser window.
    window = new electron.BrowserWindow({width: 800, height: 600})

    // and load the index.html of the app.
    window.loadURL(`file://${__dirname}/index.html`)

    // Open the DevTools.
    window.webContents.openDevTools()

    // Emitted when the window is closed.
    window.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        window = null
    })
}

electron.app.on('ready', createWindow)

// Quit when all windows are closed.
electron.app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        electron.app.quit()
    }
})

electron.app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (window === null) {
        createWindow()
    }
})

var ipc = electron.ipcMain
var fs = require('fs')

ipc.on('storeGet', event => {
    fs.readFile('store.json', (error, data) => {
        if (error) {
            console.log(error)
            return
        }

        event.sender.send('storeSet', JSON.parse(data))
    })
})

ipc.on('storeSet', (event, data) => {
    fs.writeFile('store.json', JSON.stringify(data), error => {
        if (error)
            console.log(error)

        event.sender.send('storeSetDone')
    })
})