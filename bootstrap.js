import {AdbConnector} from './src/connector.js';


document.getElementById('inputCatcher').addEventListener('click', async e => {
    let device = await AdbConnector.request_device(),
        adb_connector = new AdbConnector(device);
    await adb_connector.connect_to_interface();

    console.log(device);
    console.log(adb_connector);
    try {
        await device.open();
    } catch (e) {
        console.log(e);
        return;
    }
}, false);
