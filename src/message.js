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
        if (typeof data === 'string') data = (new TextEncoder()).encode(data);
        this.data = data;
        console.log(this);
    }

    get checksum() {
        let text_encoder = new TextEncoder(),
            encoded_data = this.data, //text_encoder.encode(this.data),
            sum_data = encoded_data.reduce((acc, cur) => {
            return acc + cur;
        }, 0);
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

    async send(adb_interface) {
        let packed_message = this.pack(),
            text_encoder = new TextEncoder();
        await adb_interface.send(packed_message);
        if (this.data) {
            let encoded_data = this.data;//text_encoder.encode(this.data);
            await adb_interface.send(encoded_data);
        }
    }
}

class AdbResponse {
    constructor(transfer_result) {
        let dv = transfer_result.data;

        this.command = dv.getInt32(0, true);
        this.arg0 = dv.getInt32(4, true);
        this.arg1 = dv.getInt32(8, true);
        this.data_length = dv.getInt32(12, true);
        this.checksum = dv.getInt32(16, true);
        this.magic = dv.getInt32(20, true);
        this.data = null;
    }

    static async from_device(adb_interface) {
        let transfer_result = await adb_interface.read(MESSAGE_SIZE),
            adb_response = new AdbResponse(transfer_result);
        console.log('fd', adb_response);
        await adb_response.fetch_data(adb_interface);
        console.log(adb_response);
        return adb_response;
    }

    get text() {
        if (!this.data) return '';
        let text_decoder = new TextDecoder();
        return text_decoder.decode(this.data);
    }

    async fetch_data(adb_interface) {
        let data_left = this.data_length,
            final_data = new ArrayBuffer(this.data_length),
            data_view = new Int8Array(final_data),
            view_position = 0;

        while(data_left > 0) {
            let response = (await adb_interface.read(data_left)).data,
                received_length = response.byteLength;
            data_left -= received_length;
            for (let i=0; i < received_length; i++) {
                data_view.set(
                    [response.getInt8(i, true)],
                    view_position++,
                );
            }
        }
        this.data = final_data;
    }
}
