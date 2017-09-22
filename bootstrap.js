

import {AdbInterface} from "./src/interface.js";

document.getElementById('inputCatcher').addEventListener('click', async e => {
    let adb_interface = await AdbInterface.new_device();
    console.log(adb_interface);
    await adb_interface.connect();
}, false);
