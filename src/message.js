export {AdbMessage, AdbResponse, SYNC, CONNECTION, AUTH, OPEN, OKAY, CLOSE, WRITE, MESSAGE_SIZE};

import * as constants from './constants.js';

const
    SYNC = constants.A_SYNC,
    CONNECTION = constants.A_CNXN,
    AUTH = constants.A_AUTH,
    OPEN = constants.A_OPEN,
    OKAY = constants.A_OKAY,
    CLOSE = constants.A_CLSE,
    WRITE = constants.A_CLSE;

// messages are 6*ints
const MESSAGE_SIZE = 6*4;

class AdbMessage {
    constructor(command, arg0, arg1, data) {
        this.wire_id = command;
        this.magic = this.wire_id ^ 0xFFFFFFFF;
        this.arg0 = arg0;
        this.arg1 = arg1;
        this.data = data;
    }

    get checksum() {
        let sum_data = this.data.split('').reduce((acc, cur) => {
            return acc + cur.charCodeAt(0);
        });
        return sum_data & 0xFFFFFFFF;
    }

    pack() {
        // construct a message of 6 32bit little-endian integers
        let ab = new ArrayBuffer(MESSAGE_SIZE),
            dv = new DataView(ab);
        dv.setInt32(0, this.wire_id, true);
        dv.setInt32(4, this.arg0, true);
        dv.setInt32(8, this.arg1, true);
        dv.setInt32(12, this.data.length, true);
        dv.setInt32(16, this.checksum, true);
        dv.setInt32(20, this.magic, true);
        return dv;
    }

    send(adb_interface) {
        let packed_message = this.pack(),
            text_encoder = new TextEncoder();
        adb_interface.send(packed_message);
        if (this.data) {
            adb_interface.send(text_encoder.encode(this.data));
        }
    }
}

class AdbResponse {
    constructor(buffer) {
        let dv = new DataView(buffer);

        this.command = dv.getInt32(0, true);
        this.arg0 = dv.getInt32(4, true);
        this.arg1 = dv.getInt32(8, true);
        this.data_length = dv.getInt32(12, true);
        this.checksum = dv.getInt32(16, true);
        this.magic = dv.getInt32(20, true);
        this.data = null;
    }

    get text() {
        if (!this.data) return '';
        let text_decoder = new TextDecoder();
        return text_decoder.decode(this.data);
    }

    async fetch_data(adb_interface) {
        let data_left = this.data_length,
            final_data = new ArrayBuffer(this.data_length),
            data_view = new Int8Array(final_data);
        while (data_left > 0) {
            let buffer = await adb_interface.read(data_left);
            data_view.set(buffer, this.data_length - data_left);
            data_left -= buffer.length;
        }
        this.data = final_data;
    }
}
